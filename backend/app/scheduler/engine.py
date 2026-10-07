import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor

from app.config import settings
from app.database import engine, SessionLocal
from app.scheduler.reminder_service import process_due_reminders

logger = logging.getLogger(__name__)

# Configure Jobstores and Executors
jobstores = {
    'default': SQLAlchemyJobStore(engine=engine, tablename='apscheduler_jobs')
}
executors = {
    'default': ThreadPoolExecutor(10)
}
job_defaults = {
    'coalesce': True,
    'max_instances': 1,
    'misfire_grace_time': 60,
}

scheduler = BackgroundScheduler(
    jobstores=jobstores,
    executors=executors,
    job_defaults=job_defaults,
    timezone="UTC",
)


def tick_reminder_worker():
    """Triggered by APScheduler every 15 seconds to dispatch due reminders and escalating notifications."""
    try:
        count = process_due_reminders()

        # Check for escalating urgent reminders
        db = SessionLocal()
        try:
            from app.smart.escalation import process_escalating_reminders
            esc_count = process_escalating_reminders(db)
            if esc_count > 0:
                logger.info(f"[Scheduler Tick] Dispatched {esc_count} escalation reminder(s).")
        finally:
            db.close()

        if count > 0:
            logger.info(f"[Scheduler Tick] Dispatched {count} due reminder(s).")
    except Exception as e:
        logger.error(f"[Scheduler Tick] Error running reminder worker: {e}")


def init_scheduler():
    """Initializes and registers persistent recurring scheduler jobs."""
    if not scheduler.get_job('process_due_reminders_job'):
        scheduler.add_job(
            tick_reminder_worker,
            trigger='interval',
            seconds=15,
            id='process_due_reminders_job',
            replace_existing=True,
        )
        logger.info("Registered 'process_due_reminders_job' in APScheduler.")
