def red_alert(score: int, intervention: str) -> str:
    return (
        f"🔴 Pegasus Alert\n\n"
        f"Your check engine light is on ({score}/100).\n\n"
        f"{intervention}\n\n"
        f"You're not alone."
    )

def yellow_warning(score: int, intervention: str) -> str:
    return (
        f"🟡 Pegasus Check-In\n\n"
        f"You're at {score}/100 today. Trending up.\n\n"
        f"{intervention}"
    )

def green_status(score: int) -> str:
    return f"🟢 Pegasus: {score}/100. Systems normal. Keep it up!"

def daily_stimulus(prompt: str) -> str:
    return (
        f"Hey! Quick Pegasus pulse check 🌱\n\n"
        f"{prompt}\n\n"
        f"(Just reply naturally — there's no wrong answer.)"
    )
