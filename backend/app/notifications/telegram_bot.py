import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
import pytz
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.models.task import Task, TaskStatusEnum
from app.crud import user as crud_user
from app.crud import task as crud_task
from app.schemas.task import TaskSnooze
from app.agent.agent_loop import AgentLoop
from app.agent.tool_executor import format_local_time

logger = logging.getLogger(__name__)


def get_or_create_telegram_user(db: Session, telegram_user) -> User:
    chat_id = str(telegram_user.id)
    user = crud_user.get_user_by_telegram_chat_id(db, chat_id=chat_id)
    if not user:
        # Check if default user exists without a chat_id, or create new
        first_user = db.query(User).filter(User.telegram_chat_id == None).first()
        if first_user:
            first_user.telegram_chat_id = chat_id
            first_user.name = telegram_user.full_name or "Telegram User"
            db.commit()
            db.refresh(first_user)
            user = first_user
        else:
            user = User(
                name=telegram_user.full_name or "Telegram User",
                telegram_chat_id=chat_id,
                timezone=settings.DEFAULT_TIMEZONE,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
    return user


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE, db_override: Optional[Session] = None):
    should_close = False
    db = db_override
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        user = get_or_create_telegram_user(db, update.effective_user)
        welcome_text = (
            f"👋 Hi {user.name}! I'm *TaskMind*, your AI task-remembering agent.\n\n"
            f"⚡ *What you can do:*\n"
            f"• Just type naturally: _'Remind me to call John tomorrow at 3pm'_\n"
            f"• Ask: _'What are my high priority tasks?'_\n"
            f"• Snooze & complete tasks directly using interactive buttons!\n\n"
            f"🌐 Current Timezone: `{user.timezone}`\n"
            f"Use /tasks to see your pending tasks or /summary for your stats."
        )
        await update.message.reply_text(welcome_text, parse_mode="Markdown")
    finally:
        if should_close:
            db.close()


async def tasks_command(update: Update, context: ContextTypes.DEFAULT_TYPE, db_override: Optional[Session] = None):
    should_close = False
    db = db_override
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        user = get_or_create_telegram_user(db, update.effective_user)
        tasks, total = crud_task.get_tasks(
            db,
            user_id=user.id,
            status=TaskStatusEnum.pending,
            limit=10,
        )
        if not tasks:
            await update.message.reply_text("🎉 You have no pending tasks right now!")
            return

        for t in tasks:
            formatted_due = format_local_time(t.due_at_utc, user.timezone)
            keyboard = [
                [
                    InlineKeyboardButton("✅ Done", callback_data=f"done:{t.id}"),
                    InlineKeyboardButton("⏳ Snooze 1h", callback_data=f"snooze_1h:{t.id}"),
                    InlineKeyboardButton("📅 Tomorrow", callback_data=f"snooze_tomorrow:{t.id}"),
                ]
            ]
            msg = f"📌 *#{t.id}: {t.title}*\n⚡ Priority: {t.priority.value.upper()}\n📅 Due: {formatted_due}"
            await update.message.reply_text(
                msg,
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard),
            )
    finally:
        if should_close:
            db.close()


async def summary_command(update: Update, context: ContextTypes.DEFAULT_TYPE, db_override: Optional[Session] = None):
    should_close = False
    db = db_override
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        user = get_or_create_telegram_user(db, update.effective_user)
        summary = crud_task.get_task_summary(db, user_id=user.id)
        msg = (
            f"📊 *TaskMind Summary Report*\n\n"
            f"📋 Total Tasks: {summary.total}\n"
            f"⏳ Pending: {summary.pending}\n"
            f"🔴 High Priority: {summary.high_priority}\n"
            f"⚠️ Overdue: {summary.overdue}\n"
            f"📅 Due Today: {summary.due_today}\n"
            f"✅ Completed: {summary.done}"
        )
        await update.message.reply_text(msg, parse_mode="Markdown")
    finally:
        if should_close:
            db.close()


async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE, db_override: Optional[Session] = None):
    query = update.callback_query
    await query.answer()

    data = query.data
    should_close = False
    db = db_override
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        user = get_or_create_telegram_user(db, update.effective_user)

        if data.startswith("done:"):
            task_id = int(data.split(":")[1])
            task = crud_task.get_task(db, task_id=task_id, user_id=user.id)
            if task:
                crud_task.complete_task(db, db_task=task)
                await query.edit_message_text(
                    f"✅ *Completed task #{task.id}: ~{task.title}~*",
                    parse_mode="Markdown",
                )
            else:
                await query.edit_message_text(f"Task #{task_id} not found.")

        elif data.startswith("snooze_1h:"):
            task_id = int(data.split(":")[1])
            task = crud_task.get_task(db, task_id=task_id, user_id=user.id)
            if task:
                snoozed = crud_task.snooze_task(db, db_task=task, snooze_in=TaskSnooze(snooze_minutes=60))
                due_str = format_local_time(snoozed.due_at_utc, user.timezone)
                await query.edit_message_text(
                    f"⏳ *Snoozed task #{task.id} for 1 hour* (New due: {due_str})",
                    parse_mode="Markdown",
                )
            else:
                await query.edit_message_text(f"Task #{task_id} not found.")

        elif data.startswith("snooze_tomorrow:"):
            task_id = int(data.split(":")[1])
            task = crud_task.get_task(db, task_id=task_id, user_id=user.id)
            if task:
                user_tz = pytz.timezone(user.timezone or "UTC")
                now_local = datetime.now(timezone.utc).astimezone(user_tz)
                tomorrow_9am = (now_local + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
                tomorrow_utc = tomorrow_9am.astimezone(timezone.utc)

                snoozed = crud_task.snooze_task(db, db_task=task, snooze_in=TaskSnooze(snooze_until=tomorrow_utc))
                due_str = format_local_time(snoozed.due_at_utc, user.timezone)
                await query.edit_message_text(
                    f"📅 *Postponed task #{task.id} to tomorrow at 9:00 AM* ({due_str})",
                    parse_mode="Markdown",
                )
            else:
                await query.edit_message_text(f"Task #{task_id} not found.")
    finally:
        if should_close:
            db.close()


async def handle_natural_language_message(update: Update, context: ContextTypes.DEFAULT_TYPE, db_override: Optional[Session] = None):
    text = update.message.text
    if not text:
        return

    should_close = False
    db = db_override
    if db is None:
        db = SessionLocal()
        should_close = True
    try:
        user = get_or_create_telegram_user(db, update.effective_user)
        agent = AgentLoop(
            db=db,
            user=user,
            session_id=f"telegram_{user.id}",
        )
        response = agent.process_message(text)
        await update.message.reply_text(response.reply)
    finally:
        if should_close:
            db.close()


def setup_telegram_bot_application(token: str) -> Optional[Application]:
    """Creates and configures the Telegram Bot application with all handlers."""
    if not token:
        return None

    application = Application.builder().token(token).build()

    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("tasks", tasks_command))
    application.add_handler(CommandHandler("list", tasks_command))
    application.add_handler(CommandHandler("summary", summary_command))
    application.add_handler(CallbackQueryHandler(handle_callback_query))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_natural_language_message))

    return application
