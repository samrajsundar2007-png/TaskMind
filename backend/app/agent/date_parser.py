import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import pytz
import dateparser


def get_user_timezone(tz_str: Optional[str]) -> pytz.BaseTzInfo:
    if not tz_str:
        return pytz.UTC
    try:
        return pytz.timezone(tz_str)
    except Exception:
        return pytz.UTC


def parse_natural_date(
    date_str: str,
    user_tz_str: str = "UTC",
    base_time_utc: Optional[datetime] = None,
) -> Optional[datetime]:
    """
    Parses a natural language date/time string relative to the user's timezone and base time.
    Returns the parsed datetime in UTC (timezone-aware).
    """
    if not date_str or not date_str.strip():
        return None

    cleaned_str = date_str.strip().lower()

    # Get user timezone
    user_tz = get_user_timezone(user_tz_str)

    # Determine current base time in user timezone
    if base_time_utc is None:
        base_time_utc = datetime.now(timezone.utc)
    elif base_time_utc.tzinfo is None:
        base_time_utc = base_time_utc.replace(tzinfo=timezone.utc)

    now_user_tz = base_time_utc.astimezone(user_tz)

    # Clean common prefixes
    cleaned_str = re.sub(r'^(by|at|on|for|due|due on|due at|before)\s+', '', cleaned_str)

    # Settings for dateparser
    settings = {
        "RELATIVE_BASE": now_user_tz.replace(tzinfo=None),
        "TIMEZONE": str(user_tz),
        "TO_TIMEZONE": "UTC",
        "RETURN_AS_TIMEZONE_AWARE": True,
        "PREFER_DATES_FROM": "future",
        "PREFER_DAY_OF_MONTH": "current",
    }

    # Custom handling for common phrases
    if cleaned_str in ("today", "tonight"):
        if cleaned_str == "today":
            # default end of working day: 6:00 PM local
            target = now_user_tz.replace(hour=18, minute=0, second=0, microsecond=0)
            if target <= now_user_tz:
                target = now_user_tz + timedelta(hours=2)
            return target.astimezone(timezone.utc)
        elif cleaned_str == "tonight":
            target = now_user_tz.replace(hour=20, minute=0, second=0, microsecond=0)
            if target <= now_user_tz:
                target = now_user_tz + timedelta(hours=1)
            return target.astimezone(timezone.utc)

    if cleaned_str in ("tomorrow", "tmrw"):
        target = (now_user_tz + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
        return target.astimezone(timezone.utc)

    if cleaned_str in ("tomorrow morning", "tmrw morning"):
        target = (now_user_tz + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
        return target.astimezone(timezone.utc)

    if cleaned_str in ("tomorrow evening", "tmrw evening", "tomorrow night"):
        target = (now_user_tz + timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
        return target.astimezone(timezone.utc)

    if cleaned_str in ("tomorrow afternoon", "tmrw afternoon"):
        target = (now_user_tz + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
        return target.astimezone(timezone.utc)

    parsed = dateparser.parse(date_str, settings=settings)
    if parsed is not None:
        if parsed.tzinfo is None:
            # Assume user timezone then convert to UTC
            localized = user_tz.localize(parsed)
            return localized.astimezone(timezone.utc)
        return parsed.astimezone(timezone.utc)

    return None


def is_date_ambiguous(text: str) -> Tuple[bool, Optional[str]]:
    """
    Checks if date expression is too vague or ambiguous to schedule accurately.
    Returns (is_ambiguous, clarification_prompt).
    """
    lower = text.lower().strip()

    ambiguous_patterns = [
        (r'\b(sometime|someday|eventually|later|soon)\b', "Could you specify a day or time (for example, 'tomorrow at 3pm' or 'next Monday')?"),
        (r'\b(next week)\b(?!\s+(on|at|monday|tuesday|wednesday|thursday|friday|saturday|sunday))', "Which day next week would you like this scheduled for?"),
        (r'\b(this weekend)\b(?!\s+(on|at|saturday|sunday|morning|evening))', "Would you prefer Saturday or Sunday, and at what time?"),
        (r'\b(in the afternoon|in the morning|in the evening)\b(?!\s+(today|tomorrow|on|next))', "Which day would you like that for (e.g. today or tomorrow)?"),
    ]

    for pattern, clarification in ambiguous_patterns:
        if re.search(pattern, lower):
            return True, clarification

    return False, None
