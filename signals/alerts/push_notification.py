"""APNs push notification — stretch goal. Wire up once Apple certs are available."""


def send_push(device_token: str, user_id: str, score: float, level: str, message: str) -> dict:
    # TODO: implement with pyapns2 or httpx against APNs once certs are provisioned
    print(f"[push_notification] Would push to {device_token}: {level} {score}/100 — {message}")
    return {"sent": False, "reason": "APNs not configured"}
