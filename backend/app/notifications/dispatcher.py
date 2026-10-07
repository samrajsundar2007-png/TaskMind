import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from app.config import settings
from app.models.reminder import Reminder
from app.models.task import Task
from app.models.user import User
from app.agent.tool_executor import format_local_time

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN
        self._bot = None

    def _get_bot(self):
        if self._bot is None and self.bot_token:
            from telegram import Bot
            self._bot = Bot(token=self.bot_token)
        return self._bot

    async def send_reminder_async(self, user: User, task: Task, reminder: Reminder) -> bool:
        """
        Asynchronously dispatches a reminder via Telegram or logs it.
        """
        user_tz = user.timezone or "UTC"
        formatted_due = format_local_time(task.due_at_utc, user_tz)

        priority_emoji = {
            "high": "🔴 High",
            "med": "🟡 Medium",
            "low": "🟢 Low",
        }.get(task.priority.value if hasattr(task.priority, 'value') else task.priority, "Medium")

        category_text = f"\n🏷️ Category: {task.category}" if task.category else ""
        desc_text = f"\n📝 {task.description}" if task.description else ""

        message_text = (
            f"⏰ *Reminder: {task.title}*\n"
            f"⚡ Priority: {priority_emoji}\n"
            f"📅 Due: {formatted_due}"
            f"{category_text}"
            f"{desc_text}"
        )

        if user.telegram_chat_id and self.bot_token:
            try:
                from telegram import InlineKeyboardButton, InlineKeyboardMarkup

                keyboard = [
                    [
                        InlineKeyboardButton("✅ Done", callback_data=f"done:{task.id}"),
                        InlineKeyboardButton("⏳ Snooze 1h", callback_data=f"snooze_1h:{task.id}"),
                        InlineKeyboardButton("📅 Tomorrow", callback_data=f"snooze_tomorrow:{task.id}"),
                    ]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)

                bot = self._get_bot()
                if bot:
                    await bot.send_message(
                        chat_id=user.telegram_chat_id,
                        text=message_text,
                        parse_mode="Markdown",
                        reply_markup=reply_markup,
                    )
                    logger.info(f"Sent reminder for task #{task.id} to Telegram chat {user.telegram_chat_id}")
                    return True
            except Exception as e:
                logger.error(f"Failed to send Telegram reminder for task #{task.id}: {e}")
                return False

        logger.info(f"[In-App/Console Dispatch] {message_text}")
        return True

    def send_reminder(self, user: User, task: Task, reminder: Reminder) -> bool:
        """
        Synchronous wrapper for sending reminders.
        """
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If running inside an existing asyncio loop, create task
                asyncio.create_task(self.send_reminder_async(user, task, reminder))
                return True
            else:
                return loop.run_until_complete(self.send_reminder_async(user, task, reminder))
        except RuntimeError:
            return asyncio.run(self.send_reminder_async(user, task, reminder))
