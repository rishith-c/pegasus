"""Pegasus web console (:4000) — a tiny ops dashboard.

Click buttons to: send an SMS check-in, simulate a user reply (which scores it
and can set reminders), test the companion chat, hear the NVIDIA voice, and read
the live wellness score. The page calls THIS server, which proxies to the
running services (signals :8002, ml :8003, video :8004) — so no CORS hassle.

Run:  python3.12 -m uvicorn server:app --host 0.0.0.0 --port 4000
"""
from __future__ import annotations

import os

import requests
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

SIGNALS = os.getenv("SIGNALS_URL", "http://127.0.0.1:8002").rstrip("/")
ML = os.getenv("ML_URL", "http://127.0.0.1:8003").rstrip("/")
VIDEO = os.getenv("VIDEO_URL", "http://127.0.0.1:8004").rstrip("/")
USER = "demo_user"

app = FastAPI(title="Pegasus Console")


def _post(url: str, body: dict, timeout: int = 120) -> dict:
    try:
        r = requests.post(url, json=body, timeout=timeout)
        try:
            return {"ok": r.ok, "status": r.status_code, "data": r.json()}
        except Exception:
            return {"ok": r.ok, "status": r.status_code, "data": r.text}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/api/checkin")
async def checkin(req: Request):
    p = (await req.json()).get("phone", "")
    _post(f"{SIGNALS}/register-phone", {"user_id": USER, "phone": p})
    return JSONResponse(_post(f"{SIGNALS}/send-checkin", {"user_id": USER, "phone": p}))


@app.post("/api/inbound")
async def inbound(req: Request):
    b = await req.json()
    # Simulate Bloo.io delivering a user's text → scores it / sets reminders.
    return JSONResponse(_post(f"{SIGNALS}/sms/webhook", {
        "event": "message.received", "sender": b.get("phone", ""), "text": b.get("text", ""),
    }))


@app.post("/api/chat")
async def chat(req: Request):
    b = await req.json()
    return JSONResponse(_post(f"{ML}/chat", {
        "user_id": USER, "messages": [{"role": "user", "content": b.get("text", "")}],
    }))


@app.post("/api/tts")
async def tts(req: Request):
    b = await req.json()
    return JSONResponse(_post(f"{VIDEO}/tts", {"text": b.get("text", "")}))


@app.get("/api/wellness")
async def wellness():
    try:
        return JSONResponse({"ok": True, "data": requests.get(f"{ML}/wellness/{USER}", timeout=15).json()})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)})


@app.get("/", response_class=HTMLResponse)
def index():
    return HTML


HTML = """<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Pegasus Console</title>
<style>
 :root{--bg:#f5f5f7;--card:#fff;--bd:#d2d2d7;--tx:#1d1d1f;--dim:#6e6e73;--blue:#0071e3;--green:#34c759;--red:#ff3b30}
 *{box-sizing:border-box;font-family:-apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif}
 body{background:var(--bg);color:var(--tx);margin:0;padding:28px;max-width:760px;margin:0 auto}
 h1{font-size:30px;font-weight:700;letter-spacing:-.02em;margin:0 0 4px}
 .sub{color:var(--dim);margin:0 0 22px}
 .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:18px;margin-bottom:14px;box-shadow:0 6px 20px rgba(0,0,0,.05)}
 .card h2{font-size:15px;font-weight:600;margin:0 0 10px}
 label{display:block;font-size:13px;color:var(--dim);margin:8px 0 4px}
 input,textarea{width:100%;padding:11px 13px;border:1px solid var(--bd);border-radius:11px;font-size:15px;background:#fafafa}
 textarea{min-height:56px;resize:vertical}
 .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
 button{background:var(--blue);color:#fff;border:0;border-radius:11px;padding:11px 16px;font-size:15px;font-weight:600;cursor:pointer}
 button.sec{background:#e8e8ed;color:var(--tx)}
 button:active{opacity:.8}
 pre{background:#1d1d1f;color:#e8e8ed;border-radius:12px;padding:14px;font-size:12.5px;overflow:auto;white-space:pre-wrap;word-break:break-word;max-height:340px}
 .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
</style></head><body>
<h1>Pegasus Console</h1>
<p class=sub>Click a button — it talks to the running services for you.</p>

<div class=card>
 <h2>📱 SMS</h2>
 <label>Phone (E.164)</label><input id=phone value="+15108046176">
 <label>Message (as if the user texted in)</label>
 <textarea id=msg>remind me to take a break in 1 minute</textarea>
 <div class=row>
  <button onclick=checkin()>Send check-in (image)</button>
  <button class=sec onclick=inbound()>Send as user → score / remind</button>
 </div>
</div>

<div class=card>
 <h2>💬 Companion + 🔊 Voice</h2>
 <label>Say something to Pegasus</label>
 <textarea id=cmsg>my manager piled three deadlines on me today</textarea>
 <div class=row>
  <button onclick=chat()>Chat reply</button>
  <button class=sec onclick=tts()>Speak it (NVIDIA TTS)</button>
  <button class=sec onclick=wellness()>Get wellness score</button>
 </div>
 <audio id=player controls style="width:100%;margin-top:10px;display:none"></audio>
</div>

<div class=card><h2>Output</h2><pre id=out>ready.</pre></div>

<script>
const out=document.getElementById('out'), player=document.getElementById('player');
const show=o=>out.textContent=(typeof o==='string'?o:JSON.stringify(o,null,2));
const P=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
async function checkin(){show('sending check-in…');show(await P('/api/checkin',{phone:phone.value}))}
async function inbound(){show('sending…');show(await P('/api/inbound',{phone:phone.value,text:msg.value}))}
async function chat(){show('thinking…');show(await P('/api/chat',{text:cmsg.value}))}
async function wellness(){show('reading…');const r=await fetch('/api/wellness').then(r=>r.json());show(r)}
async function tts(){
  show('synthesizing…');
  const r=await P('/api/tts',{text:cmsg.value});
  const a=r.data&&r.data.audio_b64;
  if(a){player.src='data:audio/wav;base64,'+a;player.style.display='block';player.play();show('▶ playing voice ('+a.length+' b64 chars)')}
  else show(r)
}
</script></body></html>"""


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=4000)
