import os
import time
import logging
import platform
import subprocess
from collections import deque
import requests
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("signals.sms")

# Recent outbound text, so the inbound iMessage poller can tell the user's
# replies apart from Pegasus's own messages echoed in the same thread.
_SENT = deque(maxlen=60)


def recently_sent(text: str, window: float = 900) -> bool:
    t = (text or "").strip()
    now = time.time()
    return any(t == s and now - ts < window for s, ts in _SENT)

BLOOIO_BASE = "https://backend.blooio.com/v2/api"
# Prefer the Mac's iMessage over Bloo.io (free, local) when set — handy once the
# Bloo.io free trial runs out. Default: try Bloo.io first, iMessage as fallback.
PREFER_IMESSAGE = os.getenv("SMS_PREFER_IMESSAGE", "").lower() in ("1", "true", "yes")

USER_PHONES: dict[str, str] = {}  # user_id -> phone


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {os.getenv('BLOOIO_API_KEY')}",
        "Content-Type": "application/json",
    }


def _download_image(url: str) -> str | None:
    """Download a remote image to a temp file so iMessage can attach the real PNG
    instead of pasting a link."""
    if not url:
        return None
    try:
        import tempfile

        r = requests.get(url, timeout=15)
        r.raise_for_status()
        ext = ".png" if ".png" in url.lower() else ".jpg"
        path = tempfile.mktemp(suffix=ext)
        with open(path, "wb") as f:
            f.write(r.content)
        return path
    except Exception as e:
        log.warning("image download failed: %s", e)
        return None


# Send FROM this iMessage account (an Apple ID / email) so Pegasus shows up as a
# SEPARATE sender instead of "you". Empty = use the first iMessage account (which,
# if it's the same Apple ID as your phone, will show as yourself).
IMESSAGE_FROM = os.getenv("IMESSAGE_FROM", "").strip()


def _send_imessage(phone: str, body: str, attachment: str = None) -> str | None:
    """Send via the Mac's Messages app (free, local). When `attachment` is given
    it sends the actual image FILE (not a link). Sends from IMESSAGE_FROM if set
    (so Pegasus is a distinct sender). Returns 'imessage_local' on success."""
    if platform.system() != "Darwin" or not phone:
        return None
    target = phone.replace('"', "")
    sends = []
    if attachment and os.path.exists(attachment):
        sends.append(f'send (POSIX file "{attachment}") to bud')
    if body:
        text = body.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
        sends.append(f'send "{text}" to bud')
    if not sends:
        return None

    if IMESSAGE_FROM:
        acct = IMESSAGE_FROM.replace('"', "")
        svc_lines = (
            "  set svc to missing value\n"
            "  repeat with s in (every service whose service type is iMessage)\n"
            f'    if (id of s) contains "{acct}" or (name of s) contains "{acct}" then\n'
            "      set svc to s\n      exit repeat\n    end if\n  end repeat\n"
            "  if svc is missing value then set svc to 1st service whose service type is iMessage\n"
        )
    else:
        svc_lines = "  set svc to 1st service whose service type is iMessage\n"

    script = (
        'tell application "Messages"\n'
        + svc_lines
        + f'  set bud to participant "{target}" of svc\n'
        + "  " + "\n  ".join(sends) + "\n"
        + "end tell"
    )
    try:
        r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=30)
        if r.returncode == 0:
            return "imessage_local"
        log.warning("iMessage send failed: %s", (r.stderr or "").strip()[:160])
    except Exception as e:
        log.warning("iMessage error: %s", e)
    return None


def _send_bloo(phone: str, body: str, media_url: str = None) -> str | None:
    """Send via Bloo.io. Returns the message id, or None on failure / no key."""
    if not os.getenv("BLOOIO_API_KEY"):
        return None
    chat_id = quote(phone, safe="")
    payload = {"text": body}
    if media_url:
        payload["attachments"] = [media_url]
    try:
        resp = requests.post(f"{BLOOIO_BASE}/chats/{chat_id}/messages",
                             headers=_headers(), json=payload, timeout=15)
        resp.raise_for_status()
        return resp.json().get("message_id", "sent")
    except Exception as e:
        log.warning("Bloo.io send failed: %s", e)
        return None


def send_sms(phone: str, body: str, media_url: str = None) -> str:
    """Deliver a message. Tries Bloo.io (iMessage/SMS gateway) first, then falls
    back to the Mac's own iMessage so messages still reach the phone for free when
    Bloo.io is unavailable (e.g. free-trial credits exhausted). Never raises."""
    _SENT.append((body.strip(), time.time()))  # so the inbound poller skips our echo
    if not PREFER_IMESSAGE:
        sid = _send_bloo(phone, body, media_url)
        if sid:
            return sid

    # iMessage fallback — download + attach the ACTUAL image, not a link.
    attach = _download_image(media_url) if media_url else None
    local = _send_imessage(phone, body, attach)
    if local:
        return local

    if PREFER_IMESSAGE:  # iMessage was first choice and failed — try Bloo as backup
        sid = _send_bloo(phone, body, media_url)
        if sid:
            return sid

    if not os.getenv("BLOOIO_API_KEY"):
        return "noop_no_api_key"
    return "payment_required: Bloo.io credits exhausted — add credits, or sign into iMessage on this Mac."


def send_alert_sms(user_id: str, score: int, intervention: str) -> str:
    from alerts.templates import red_alert
    phone = USER_PHONES.get(user_id)
    if not phone:
        return "no_phone_on_file"
    body = red_alert(score, intervention)
    return send_sms(phone, body)
