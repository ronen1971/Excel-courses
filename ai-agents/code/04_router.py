"""שיעור 3.2 - דפוס הנתב (Router): מודל קטן ומהיר ממיין, סוכן מומחה מטפל.

הודעה בין סוכנים = מבנה נתונים מוגדר (Pydantic), לא טקסט חופשי.
"""
from typing import Literal

import anthropic
from pydantic import BaseModel

client = anthropic.Anthropic()


class Route(BaseModel):
    department: Literal["billing", "technical", "sales", "other"]
    urgency: Literal["low", "normal", "high"]
    summary: str


SPECIALISTS = {
    "billing": "אתה נציג חיובים. בדוק את הבעיה, הסבר בסבלנות והצע פתרון. אל תבטיח החזרים בלי אישור.",
    "technical": "אתה תומך טכני. שאל שאלה מבהירה אחת אם חסר מידע, ואז תן הוראות ממוספרות.",
    "sales": "אתה איש מכירות הוגן. הצג את החבילה המתאימה בלי לחץ.",
    "other": "אתה נציג שירות כללי. הפנה בנימוס לגורם המתאים.",
}


def route(message: str) -> Route:
    """סוכן 1: הנתב. Haiku - זול ומהיר, מספיק למיון."""
    response = client.messages.parse(
        model="claude-haiku-5-5",
        max_tokens=1024,
        output_config={"effort": "low"},
        system="סווג את פניית הלקוח למחלקה ולדחיפות, וסכם אותה במשפט.",
        messages=[{"role": "user", "content": message}],
        output_format=Route,
    )
    return response.parsed_output


def handle(message: str) -> str:
    r = route(message)
    print(f"[נתב] {r.department} / {r.urgency}: {r.summary}")
    # סוכן 2: המומחה. מקבל רק את מה שהוא צריך
    response = client.messages.create(
        model="claude-opus-5-5",
        max_tokens=16000,
        system=SPECIALISTS[r.department],
        messages=[{"role": "user", "content": f"דחיפות: {r.urgency}\n\nפניית הלקוח:\n{message}"}],
    )
    return "".join(b.text for b in response.content if b.type == "text")


if __name__ == "__main__":
    print(handle("חויבתי פעמיים החודש על המנוי ואני ממש לא מרוצה!"))
