"""שיעור 2.3 - לולאת סוכן ידנית: המודל מחליט אילו כלים להפעיל, אנחנו מריצים אותם.

זה הלב של כל סוכן: שולחים -> המודל מבקש כלי -> מריצים -> מחזירים תוצאה -> חוזר חלילה.
"""
import json
from datetime import datetime

import anthropic

client = anthropic.Anthropic()

# 1. הגדרת כלים: שם, תיאור (המודל קורא אותו!) וסכמת קלט
TOOLS = [
    {
        "name": "calculator",
        "description": "מחשב ביטוי חשבוני פשוט. השתמש בו לכל חישוב מספרי.",
        "input_schema": {
            "type": "object",
            "properties": {"expression": {"type": "string", "description": "למשל: (120*3)+45"}},
            "required": ["expression"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "get_time",
        "description": "מחזיר את התאריך והשעה הנוכחיים.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "strict": True,
    },
]


def run_tool(name: str, tool_input: dict) -> str:
    """2. הביצוע בפועל - הקוד שלנו, לא של המודל."""
    if name == "calculator":
        expr = tool_input["expression"]
        if not set(expr) <= set("0123456789+-*/(). "):
            raise ValueError("מותרים רק מספרים ואופרטורים")
        return str(eval(expr, {"__builtins__": {}}))  # בטוח כי סיננו תווים
    if name == "get_time":
        return datetime.now().isoformat(timespec="minutes")
    raise ValueError(f"כלי לא מוכר: {name}")


def run_agent(task: str, max_turns: int = 10) -> str:
    messages = [{"role": "user", "content": task}]
    for _ in range(max_turns):  # 3. תקרה - סוכן בלי תקרה יכול לרוץ לנצח
        response = client.messages.create(
            model="claude-opus-5-5",
            max_tokens=16000,
            tools=TOOLS,
            messages=messages,
        )
        # מוסיפים את כל התוכן (לא רק טקסט) - כולל בלוקי חשיבה וכלים
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "refusal":
            return "הבקשה נדחתה."
        if response.stop_reason != "tool_use":
            return "".join(b.text for b in response.content if b.type == "text")

        # 4. מריצים את כל הכלים שהתבקשו ומחזירים את כל התוצאות בהודעה אחת
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            print(f"  -> {block.name}({json.dumps(block.input, ensure_ascii=False)})")
            try:
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": run_tool(block.name, block.input)})
            except Exception as e:  # שגיאה חוזרת למודל, הוא יכול לתקן את עצמו
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": f"שגיאה: {e}", "is_error": True})
        messages.append({"role": "user", "content": results})
    return "הסוכן הגיע לתקרת הסבבים."


if __name__ == "__main__":
    print(run_agent("איזה יום היום? וכמה זה 17.5% מע״מ על 2,340 ש״ח?"))
