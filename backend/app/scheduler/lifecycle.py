import logging
import asyncio
from typing import Optional

from app.config import settings
from app.scheduler.engine import scheduler, init_scheduler
from app.scheduler.reminder_service import process_due_reminders
from app.notifications.telegram_bot import setup_telegram_bot_application

logger = logging.getLogger(__name__)

telegram_app = None


def start_scheduler():
    """Starts the APScheduler and runs an immediate startup recovery sweep."""
    try:
        # 1. Startup recovery sweep for any reminders due while server was offline
        recovered = process_due_reminders()
        logger.info(f"Startup recovery sweep completed: {recovered} missed reminders dispatched.")

        # 2. Initialize and start persistent scheduler
        init_scheduler()
        if not scheduler.running:
            scheduler.start()
            logger.info("APScheduler started successfully.")
    except Exception as e:
        logger.error(f"Error starting scheduler: {e}")


def stop_scheduler():
    """Cleanly stops the APScheduler on application shutdown."""
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
            logger.info("APScheduler stopped.")
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")


async def start_telegram_bot():
    """Initializes and starts polling Telegram bot if token is configured."""
    global telegram_app
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.info("TELEGRAM_BOT_TOKEN not configured; Telegram Bot polling disabled.")
        return

    try:
        telegram_app = setup_telegram_bot_application(settings.TELEGRAM_BOT_TOKEN)
        if telegram_app:
            await telegram_app.initialize()
            await telegram_app.start()
            await telegram_app.updater.start_polling()
            logger.info("Telegram Bot polling started successfully.")
    except Exception as e:
        logger.error(f"Failed to start Telegram Bot: {e}")


async def stop_telegram_bot():
    """Cleanly stops the Telegram bot."""
    global telegram_app
    if telegram_app:
        try:
            await telegram_app.updater.stop()
            await telegram_app.stop()
            await telegram_app.shutdown()
            logger.info("Telegram Bot stopped.")
        except Exception as e:
            logger.error(f"Error stopping Telegram Bot: {e}")
