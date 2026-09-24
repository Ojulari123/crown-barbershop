"""Background jobs. Started in main.py's lifespan, so only a running server schedules work.

Render runs one instance with one uvicorn worker (validation.md V26). A second process
would still be safe: the outbox uses SKIP LOCKED and reminders are unique per day.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from Utils.clock import TZ
from Utils.sms import process_outbox, queue_reminders


def build_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=TZ)
    scheduler.add_job(process_outbox, "interval", seconds=5, id="sms_outbox",
                      max_instances=1, coalesce=True)
    scheduler.add_job(queue_reminders, CronTrigger(hour=9, minute=0, timezone=TZ), id="sms_reminders",
                      misfire_grace_time=3600, coalesce=True)
    return scheduler
