def parse_twilio_webhook(form: dict) -> dict:
    """Parse a Twilio inbound SMS/iMessage webhook payload into a clean dict."""
    return {
        "from_number": form.get("From", "").strip(),
        "to_number":   form.get("To", "").strip(),
        "body":        form.get("Body", "").strip(),
        "message_sid": form.get("MessageSid", ""),
        "num_media":   int(form.get("NumMedia", 0)),
    }
