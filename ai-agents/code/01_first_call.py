"""שיעור 2.1 - קריאת API ראשונה ל-Claude.

הרצה:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY=...   # או: ant auth login
    python 01_first_call.py
"""
import anthropic

client = anthropic.Anthropic()  # קורא את המפתח מהסביבה - לעולם לא לכתוב מפתח בקוד

response = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,
    system="אתה עוזר קצר ולעניין. ענה בעברית.",
    messages=[{"role": "user", "content": "הסבר במשפט אחד מה זה סוכן AI."}],
)

if response.stop_reason == "refusal":
    print("הבקשה נדחתה:", response.stop_details)
else:
    for block in response.content:
        if block.type == "text":
            print(block.text)

print("טוקנים:", response.usage.input_tokens, "נכנסו,", response.usage.output_tokens, "יצאו")
