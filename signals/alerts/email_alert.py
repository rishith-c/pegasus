"""Email summary alert — stretch goal. Plug in SendGrid or SMTP as needed."""
import os


def send_weekly_summary(email: str, user_id: str, avg_score: float, top_flags: list) -> dict:
    with open(
        os.path.join(os.path.dirname(__file__), "templates", "weekly_summary.txt"),
        encoding="utf-8",
    ) as f:
        template = f.read()

    body = template.format(
        user_id=user_id,
        avg_score=round(avg_score, 1),
        top_flags=", ".join(top_flags) if top_flags else "none",
    )

    # TODO: wire up SendGrid / smtplib once API key is available
    print(f"[email_alert] Would send to {email}:\n{body}")
    return {"sent": False, "reason": "email transport not configured"}
