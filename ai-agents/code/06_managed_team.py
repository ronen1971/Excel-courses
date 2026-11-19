"""מודול 5 - רשת סוכנים מנוהלת (Claude Managed Agents, בטא).

כאן Anthropic מריצה את הלולאה ואת סביבת הביצוע. אנחנו רק מגדירים צוות:
  מוביל (Opus 5.5) שמאציל לחוקר זול (Haiku 5.5) ולעותקים של עצמו.

שימו לב: Managed Agents מחויב גם על זמן ריצת הסשן בנוסף לטוקנים,
ושומר היסטוריית סשנים עד שמוחקים אותה. סוכנים נוצרים פעם אחת - שמרו את ה-ID.
"""
import anthropic

client = anthropic.Anthropic()

# --- הגדרה חד-פעמית (setup). בייצור: הריצו פעם אחת ושמרו את ה-IDs ---
environment = client.beta.environments.create(
    name="research-team-env",
    config={
        "type": "cloud",
        # רשת מוגבלת: כלי הרשת של הסוכנים מגיעים רק לאתרים שברשימה. הוסיפו את האתרים שהמחקר צריך.
        # "unrestricted" פותח את כל הסביבה לאינטרנט - בחרו בזה רק במודע, ובלי סודות או קבצים רגישים בסביבה.
        "networking": {"type": "limited", "allowed_hosts": ["he.wikipedia.org", "www.gov.il"]},
    },
)

worker = client.beta.agents.create(
    name="Web researcher",
    description="חוקר זול ומהיר לקריאה בלבד. תן לו שאלה ממוקדת אחת; הוא מחפש, קורא ומחזיר ממצאים עם מקור לכל טענה.",
    model="claude-haiku-5-5",
    system="ענה בדיוק על השאלה שקיבלת. חפש וקרא כמה שצריך, והחזר ממצאים תמציתיים עם כתובת מקור לכל טענה.",
    tools=[{
        "type": "agent_toolset_20260401",
        "default_config": {"enabled": False, "permission_policy": {"type": "auto"}},
        "configs": [{"name": n, "enabled": True} for n in ("read", "web_fetch", "web_search")],
    }],
)

lead = client.beta.agents.create(
    name="Research lead",
    description="מתכנן ומסנתז מחקר. אפשר להפעיל עותק שלו לתת-ניתוח גדול.",
    model="claude-opus-5-5",
    system=(
        "תכנן את העבודה. העבר כל שאלה עצמאית שדורשת הרבה קריאה ל-Web researcher, "
        "משימה אחת לכל הפעלה, כמה במקביל. כשיש יותר שאלות ממה שכמה הפעלות מכסות - "
        "הפעל workflow run. את האימות והסיכום הסופי עשה בעצמך. "
        "כתוב את הדוח הסופי ל-/mnt/session/outputs/report.md בעברית."
    ),
    tools=[{
        "type": "agent_toolset_20260401",
        "default_config": {"permission_policy": {"type": "auto"}},
        "configs": [{"name": n, "enabled": True} for n in ("web_fetch", "web_search")],
    }],
    multiagent={
        "type": "multiagent_20261001",
        "subagents": {"type": "enabled", "predefined_agents": [worker.id, {"type": "self"}],
                      "inline_agents": {"type": "disabled"}},
        "workflows": {"type": "enabled", "predefined_agents": [worker.id],
                      "inline_agents": {"type": "disabled"}},
    },
)
print("שמרו:", environment.id, lead.id)

# --- הרצה (בכל פעם): סשן חדש עם תקרת עלות ---
session = client.beta.sessions.create(
    agent=lead.id,
    environment_id=environment.id,
    budget={"type": "limit", "max_list_cost": {"amount": "500", "currency": "USD"}},  # $5.00
)

with client.beta.sessions.events.stream(session_id=session.id) as stream:
    client.beta.sessions.events.send(
        session_id=session.id,
        events=[{"type": "user.message", "content": [{"type": "text", "text":
                 "השווה בין 3 גישות לבניית סוכני שירות לקוחות לעסק קטן: יתרונות, חסרונות ועלות משוערת."}]}],
    )
    for event in stream:
        if event.type == "agent.message":
            for block in event.content:
                if block.type == "text":
                    print(block.text, end="", flush=True)
        elif event.type == "agent.tool_use" and event.evaluated_permission == "ask":
            # אף אחד לא צופה בהרצה הזו - דוחים כל פעולה שדורשת אישור
            client.beta.sessions.events.send(
                session_id=session.id,
                events=[{"type": "user.tool_confirmation", "tool_use_id": event.id, "result": "deny"}],
            )
        elif event.type == "session.status_idle" and event.stop_reason.type != "requires_action":
            break
        elif event.type == "session.status_terminated":
            break

print(f"\n\nצפייה בסשן: https://platform.claude.com/workspaces/default/sessions/{session.id}")
