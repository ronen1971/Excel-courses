"""שיעור 2.4 - אותו סוכן, בלי לכתוב את הלולאה: ה-Tool Runner של ה-SDK (בטא).

הסכמה נבנית אוטומטית מחתימת הפונקציה ומה-docstring.
"""
import anthropic
from anthropic import beta_tool

client = anthropic.Anthropic()

INVENTORY = {"מקלדת": 14, "עכבר": 0, "מסך": 3}


@beta_tool
def check_stock(product: str) -> str:
    """בודק כמה יחידות יש במלאי.

    Args:
        product: שם המוצר בעברית, למשל "מקלדת".
    """
    if product not in INVENTORY:
        return f"המוצר '{product}' לא קיים. מוצרים: {', '.join(INVENTORY)}"
    return f"{INVENTORY[product]} יחידות"


@beta_tool
def create_order(product: str, quantity: int) -> str:
    """יוצר הזמנת רכש מספק.

    Args:
        product: שם המוצר.
        quantity: מספר יחידות להזמין.
    """
    return f"הזמנה נוצרה: {quantity} x {product}"


runner = client.beta.messages.tool_runner(
    model="claude-opus-5-5",
    max_tokens=16000,
    tools=[check_stock, create_order],
    system="אתה סוכן מלאי. אם מוצר אזל - הזמן 20 יחידות. סכם בעברית.",
    messages=[{"role": "user", "content": "תבדוק את המלאי של מקלדת, עכבר ומסך."}],
)

for message in runner:  # כל איטרציה = תגובה אחת של המודל
    for block in message.content:
        if block.type == "tool_use":
            print(f"  -> {block.name}({block.input})")
        elif block.type == "text":
            print(block.text)
