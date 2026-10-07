from datetime import datetime, timezone
from sqlalchemy import TypeDecorator, DateTime
from app.database import Base


class UTCDateTime(TypeDecorator):
    """
    Ensures datetimes are always stored and retrieved with UTC timezone info,
    even on databases like SQLite that do not natively store timezones.
    """
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if isinstance(value, str):
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            else:
                value = value.astimezone(timezone.utc)
            # For SQLite compatibility
            if dialect.name == "sqlite":
                return value.replace(tzinfo=None)
            return value
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)
        return value
