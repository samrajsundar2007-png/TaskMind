from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
import pytz

from app.models.task import Task, PriorityEnum, TaskStatusEnum
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskSnooze
from app.crud import task as crud_task
from app.crud import user as crud_user
from app.agent.date_parser import parse_natural_date, get_user_timezone


class ToolExecutionResult:
    def __init__(self, success: bool, message: str, data: Optional[Dict[str, Any]] = None, requires_confirmation: bool = False):
        self.success = success
        self.message = message
        self.data = data or {}
        self.requires_confirmation = requires_confirmation

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "message": self.message,
            "data": self.data,
            "requires_confirmation": self.requires_confirmation,
        }


def format_local_time(dt_utc: Optional[datetime], user_tz_str: str) -> str:
    if not dt_utc:
        return "no due date"
    user_tz = get_user_timezone(user_tz_str)
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    local_dt = dt_utc.astimezone(user_tz)
    return local_dt.strftime("%b %d at %I:%M %p")


class ToolExecutor:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user
        self.user_tz = user.timezone or "UTC"

    def execute(self, tool_name: str, arguments: Dict[str, Any]) -> ToolExecutionResult:
        method_map = {
            "add_task": self.add_task,
            "list_tasks": self.list_tasks,
            "update_task": self.update_task,
            "complete_task": self.complete_task,
            "snooze_task": self.snooze_task,
            "delete_task": self.delete_task,
            "search_tasks": self.search_tasks,
            "get_summary": self.get_summary,
        }

        handler = method_map.get(tool_name)
        if not handler:
            return ToolExecutionResult(
                success=False,
                message=f"Unknown tool '{tool_name}'"
            )

        try:
            return handler(**arguments)
        except TypeError as e:
            return ToolExecutionResult(
                success=False,
                message=f"Invalid arguments for {tool_name}: {str(e)}"
            )
        except Exception as e:
            return ToolExecutionResult(
                success=False,
                message=f"Error executing {tool_name}: {str(e)}"
            )

    def add_task(
        self,
        title: str,
        due_date: Optional[str] = None,
        priority: str = "med",
        category: Optional[str] = None,
        estimated_minutes: Optional[int] = None,
        recurrence_rule: Optional[str] = None,
    ) -> ToolExecutionResult:
        # Validate priority
        try:
            p_enum = PriorityEnum(priority.lower())
        except Exception:
            p_enum = PriorityEnum.med

        # Parse due date with user's timezone
        due_at_utc = None
        if due_date:
            due_at_utc = parse_natural_date(due_date, user_tz_str=self.user_tz)

        task_in = TaskCreate(
            user_id=self.user.id,
            title=title.strip(),
            due_at_utc=due_at_utc,
            priority=p_enum,
            category=category.strip() if category else None,
            estimated_minutes=estimated_minutes,
            recurrence_rule=recurrence_rule,
            remind_at_utc=due_at_utc,
        )

        task = crud_task.create_task(self.db, task_in=task_in)
        formatted_due = format_local_time(task.due_at_utc, self.user_tz)

        return ToolExecutionResult(
            success=True,
            message=f"Created task #{task.id}: '{task.title}' (Due: {formatted_due}, Priority: {task.priority.value})",
            data={
                "task_id": task.id,
                "title": task.title,
                "due_at_utc": task.due_at_utc.isoformat() if task.due_at_utc else None,
                "formatted_due": formatted_due,
                "priority": task.priority.value,
                "category": task.category,
                "status": task.status.value,
            }
        )

    def list_tasks(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        date_range: Optional[str] = None,
    ) -> ToolExecutionResult:
        status_enum = None
        if status:
            try:
                status_enum = TaskStatusEnum(status.lower())
            except Exception:
                pass
        else:
            # Default to active pending/snoozed if not specified
            status_enum = None

        priority_enum = None
        if priority:
            try:
                priority_enum = PriorityEnum(priority.lower())
            except Exception:
                pass

        now_utc = datetime.now(timezone.utc)
        user_tz = get_user_timezone(self.user_tz)
        now_local = now_utc.astimezone(user_tz)
        today_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = today_start_local.astimezone(timezone.utc)
        tomorrow_start_utc = (today_start_local + timedelta(days=1)).astimezone(timezone.utc)
        week_end_utc = (today_start_local + timedelta(days=7)).astimezone(timezone.utc)

        due_after = None
        due_before = None

        if date_range == "today":
            due_after = today_start_utc
            due_before = tomorrow_start_utc
        elif date_range == "tomorrow":
            due_after = tomorrow_start_utc
            due_before = (today_start_local + timedelta(days=2)).astimezone(timezone.utc)
        elif date_range == "this_week":
            due_after = today_start_utc
            due_before = week_end_utc
        elif date_range == "overdue":
            due_before = now_utc
            if not status_enum:
                status_enum = TaskStatusEnum.pending
        elif date_range == "upcoming":
            due_after = now_utc

        tasks, total = crud_task.get_tasks(
            self.db,
            user_id=self.user.id,
            status=status_enum,
            priority=priority_enum,
            category=category,
            due_after=due_after,
            due_before=due_before,
            limit=50,
        )

        task_summaries = []
        for t in tasks:
            task_summaries.append({
                "id": t.id,
                "title": t.title,
                "status": t.status.value,
                "priority": t.priority.value,
                "category": t.category,
                "due": format_local_time(t.due_at_utc, self.user_tz),
            })

        return ToolExecutionResult(
            success=True,
            message=f"Found {len(task_summaries)} task(s).",
            data={"total": total, "tasks": task_summaries}
        )

    def update_task(
        self,
        task_id: int,
        title: Optional[str] = None,
        due_date: Optional[str] = None,
        priority: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        estimated_minutes: Optional[int] = None,
    ) -> ToolExecutionResult:
        task = crud_task.get_task(self.db, task_id=task_id, user_id=self.user.id)
        if not task:
            return ToolExecutionResult(
                success=False,
                message=f"Task #{task_id} not found."
            )

        p_enum = None
        if priority:
            try:
                p_enum = PriorityEnum(priority.lower())
            except Exception:
                pass

        s_enum = None
        if status:
            try:
                s_enum = TaskStatusEnum(status.lower())
            except Exception:
                pass

        due_at_utc = None
        if due_date:
            due_at_utc = parse_natural_date(due_date, user_tz_str=self.user_tz)

        task_in = TaskUpdate(
            title=title,
            due_at_utc=due_at_utc,
            priority=p_enum,
            category=category,
            status=s_enum,
            estimated_minutes=estimated_minutes,
        )

        updated_task = crud_task.update_task(self.db, db_task=task, task_in=task_in)
        formatted_due = format_local_time(updated_task.due_at_utc, self.user_tz)

        return ToolExecutionResult(
            success=True,
            message=f"Updated task #{updated_task.id}: '{updated_task.title}' (Due: {formatted_due}, Priority: {updated_task.priority.value})",
            data={
                "task_id": updated_task.id,
                "title": updated_task.title,
                "priority": updated_task.priority.value,
                "status": updated_task.status.value,
                "due": formatted_due,
            }
        )

    def complete_task(self, task_id: int) -> ToolExecutionResult:
        task = crud_task.get_task(self.db, task_id=task_id, user_id=self.user.id)
        if not task:
            return ToolExecutionResult(
                success=False,
                message=f"Task #{task_id} not found."
            )

        completed_task = crud_task.complete_task(self.db, db_task=task)
        return ToolExecutionResult(
            success=True,
            message=f"Completed task #{completed_task.id}: '{completed_task.title}'.",
            data={"task_id": completed_task.id, "title": completed_task.title, "status": "done"}
        )

    def snooze_task(
        self,
        task_id: int,
        duration_minutes: Optional[int] = None,
        snooze_until: Optional[str] = None,
    ) -> ToolExecutionResult:
        task = crud_task.get_task(self.db, task_id=task_id, user_id=self.user.id)
        if not task:
            return ToolExecutionResult(
                success=False,
                message=f"Task #{task_id} not found."
            )

        snooze_dt_utc = None
        if snooze_until:
            snooze_dt_utc = parse_natural_date(snooze_until, user_tz_str=self.user_tz)

        snooze_in = TaskSnooze(
            snooze_until=snooze_dt_utc,
            snooze_minutes=duration_minutes,
        )

        snoozed_task = crud_task.snooze_task(self.db, db_task=task, snooze_in=snooze_in)
        formatted_due = format_local_time(snoozed_task.due_at_utc, self.user_tz)

        return ToolExecutionResult(
            success=True,
            message=f"Snoozed task #{snoozed_task.id} until {formatted_due}.",
            data={"task_id": snoozed_task.id, "title": snoozed_task.title, "snoozed_until": formatted_due}
        )

    def delete_task(self, task_id: int, confirmed: bool = False) -> ToolExecutionResult:
        task = crud_task.get_task(self.db, task_id=task_id, user_id=self.user.id)
        if not task:
            return ToolExecutionResult(
                success=False,
                message=f"Task #{task_id} not found."
            )

        if not confirmed:
            return ToolExecutionResult(
                success=False,
                message=f"Are you sure you want to delete task #{task.id}: '{task.title}'?",
                requires_confirmation=True,
                data={"task_id": task.id, "title": task.title}
            )

        title = task.title
        crud_task.delete_task(self.db, db_task=task)
        return ToolExecutionResult(
            success=True,
            message=f"Deleted task #{task_id}: '{title}'.",
            data={"task_id": task_id, "deleted": True}
        )

    def search_tasks(self, query: str) -> ToolExecutionResult:
        tasks, total = crud_task.get_tasks(
            self.db,
            user_id=self.user.id,
            search=query,
            limit=20,
        )

        results = [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status.value,
                "priority": t.priority.value,
                "category": t.category,
                "due": format_local_time(t.due_at_utc, self.user_tz),
            }
            for t in tasks
        ]

        return ToolExecutionResult(
            success=True,
            message=f"Found {len(results)} task(s) matching '{query}'.",
            data={"total": total, "tasks": results}
        )

    def get_summary(self, period: Optional[str] = "all") -> ToolExecutionResult:
        summary = crud_task.get_task_summary(self.db, user_id=self.user.id)
        return ToolExecutionResult(
            success=True,
            message=f"You have {summary.pending} pending tasks ({summary.high_priority} high priority, {summary.overdue} overdue, {summary.due_today} due today) and {summary.done} completed.",
            data=summary.model_dump()
        )
