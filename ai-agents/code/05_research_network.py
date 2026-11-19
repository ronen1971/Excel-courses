"""מודול 4 - פרויקט: רשת סוכני מחקר (Orchestrator -> Workers -> Writer).

  מתאם (Opus 5.5)  ->  מפרק שאלה ל-N תתי-שאלות (פלט מובנה)
  חוקרים (Haiku 5.5) -> רצים במקביל, כל אחד עם הקשר נקי ותתי-שאלה אחת
  כותב (Opus 5.5)   ->  מאחד את הממצאים לדוח אחד

הרשת כאן מתואמת ע"י הקוד שלנו (workflow): אנחנו קובעים את הסדר, המודלים עושים את החשיבה.
"""
import asyncio
import sys

import anthropic
from pydantic import BaseModel, Field

client = anthropic.AsyncAnthropic()

MAX_WORKERS = 5            # תקרת עלות: לא יותר מ-5 חוקרים
SEM = asyncio.Semaphore(3)  # לא יותר מ-3 קריאות במקביל (מגבלות קצב)


# ---------- חוזי ההודעות בין הסוכנים ----------
class SubTask(BaseModel):
    title: str
    question: str = Field(description="שאלה עצמאית ומלאה - החוקר לא רואה את השאלה המקורית")


class Plan(BaseModel):
    subtasks: list[SubTask]


class Finding(BaseModel):
    title: str
    key_points: list[str]
    confidence: str = Field(description="high / medium / low")
    open_questions: list[str]


# ---------- סוכן 1: המתאם ----------
async def plan(question: str) -> Plan:
    response = await client.messages.parse(
        model="claude-opus-5-5",
        max_tokens=16000,
        output_config={"effort": "high"},
        system=(
            "אתה מתאם מחקר. פרק את השאלה ל-2 עד "
            f"{MAX_WORKERS} תתי-שאלות בלתי תלויות שלא חופפות. "
            "כל תת-שאלה חייבת לעמוד בפני עצמה: החוקר לא רואה את השאלה המקורית."
        ),
        messages=[{"role": "user", "content": question}],
        output_format=Plan,
    )
    p = response.parsed_output
    p.subtasks = p.subtasks[:MAX_WORKERS]
    return p


# ---------- סוכן 2: חוקר (רץ במקביל) ----------
async def research(task: SubTask) -> Finding:
    async with SEM:
        response = await client.messages.parse(
            model="claude-haiku-5-5",
            max_tokens=8000,
            output_config={"effort": "low"},
            system=(
                "אתה חוקר ממוקד. ענה רק על השאלה שקיבלת. "
                "סמן ביטחון נמוך כשאינך בטוח, ואל תמציא עובדות או מספרים."
            ),
            messages=[{"role": "user", "content": task.question}],
            output_format=Finding,
        )
    f = response.parsed_output
    f.title = task.title
    print(f"  ✓ {task.title} ({f.confidence})")
    return f


# ---------- סוכן 3: הכותב ----------
async def write_report(question: str, findings: list[Finding]) -> str:
    notes = "\n\n".join(f.model_dump_json(indent=2) for f in findings)
    async with client.messages.stream(
        model="claude-opus-5-5",
        max_tokens=64000,
        output_config={"effort": "medium"},
        system=(
            "אתה כותב דוחות. כתוב דוח בעברית: תקציר מנהלים, ממצאים לפי נושא, "
            "ושאלות פתוחות. אם ממצאים סותרים - ציין זאת במפורש. "
            "אל תוסיף מידע שלא מופיע בממצאים."
        ),
        messages=[{"role": "user", "content": f"השאלה: {question}\n\nממצאי החוקרים:\n{notes}"}],
    ) as stream:
        async for text in stream.text_stream:
            print(text, end="", flush=True)
        final = await stream.get_final_message()
    return "".join(b.text for b in final.content if b.type == "text")


async def main(question: str) -> None:
    print("[מתאם] מתכנן...")
    p = await plan(question)
    for t in p.subtasks:
        print(f"  • {t.title}")

    print(f"[חוקרים] {len(p.subtasks)} במקביל...")
    results = await asyncio.gather(*(research(t) for t in p.subtasks), return_exceptions=True)
    findings = [r for r in results if isinstance(r, Finding)]
    failed = len(results) - len(findings)
    if failed:
        print(f"  ! {failed} חוקרים נכשלו - ממשיכים עם מה שיש")
    if not findings:
        sys.exit("אין ממצאים - עוצרים.")

    print("[כותב] מאחד:\n")
    report = await write_report(question, findings)
    with open("report.md", "w", encoding="utf-8") as fh:
        fh.write(report)
    print("\n\nנשמר ב-report.md")


if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or "איך עסק קטן בישראל יכול להתחיל להשתמש בסוכני AI בשירות לקוחות?"
    asyncio.run(main(q))
