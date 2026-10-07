import pytest
from datetime import datetime, timezone
from app.models import User
from app.agent.agent_loop import AgentLoop
from app.agent.providers.mock_provider import MockLLMProvider


# 30 Sample Evaluation Benchmark Sentences
EVAL_BENCHMARK = [
    # 1-8: Add Task variations
    {
        "sentence": "Add task to call Mom tomorrow at 5pm",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "Call Mom", "has_due_date": True},
        "is_ambiguous": False,
    },
    {
        "sentence": "Remind me to submit the quarterly taxes tomorrow 9am urgent",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "quarterly taxes", "priority": "high"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Add a task to buy groceries category Personal",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "groceries", "category": "Personal"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Create a task Review design mockups for 45 minutes",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "Review design mockups", "estimated_minutes": 45},
        "is_ambiguous": False,
    },
    {
        "sentence": "Take vitamin D every morning",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "Take vitamin D", "recurrence_rule": "FREQ=DAILY"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Team sync meeting every Monday at 10am",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "Team sync", "recurrence_rule": "FREQ=WEEKLY"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Remind me to check the oven in 30 minutes",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "check the oven", "has_due_date": True},
        "is_ambiguous": False,
    },
    {
        "sentence": "Wash the car tomorrow low priority",
        "expected_tool": "add_task",
        "expected_args": {"title_contains": "Wash the car", "priority": "low"},
        "is_ambiguous": False,
    },

    # 9-10: Date Ambiguity Detection
    {
        "sentence": "Remind me to buy a new laptop sometime later",
        "expected_tool": None,
        "is_ambiguous": True,
    },
    {
        "sentence": "Schedule dentist appointment next week",
        "expected_tool": None,
        "is_ambiguous": True,
    },

    # 11-17: List & Filter variations
    {
        "sentence": "Show my tasks for today",
        "expected_tool": "list_tasks",
        "expected_args": {"date_range": "today"},
        "is_ambiguous": False,
    },
    {
        "sentence": "What are my tasks for tomorrow?",
        "expected_tool": "list_tasks",
        "expected_args": {"date_range": "tomorrow"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Show all my high priority tasks",
        "expected_tool": "list_tasks",
        "expected_args": {"priority": "high"},
        "is_ambiguous": False,
    },
    {
        "sentence": "List overdue tasks",
        "expected_tool": "list_tasks",
        "expected_args": {"date_range": "overdue"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Show my tasks in category Work",
        "expected_tool": "list_tasks",
        "expected_args": {"category": "Work"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Show completed tasks",
        "expected_tool": "list_tasks",
        "expected_args": {"status": "done"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Show upcoming tasks for this week",
        "expected_tool": "list_tasks",
        "expected_args": {"date_range": "this_week"},
        "is_ambiguous": False,
    },

    # 18-20: Complete Task variations
    {
        "sentence": "Complete task 1",
        "expected_tool": "complete_task",
        "expected_args": {"task_id": 1},
        "is_ambiguous": False,
    },
    {
        "sentence": "Mark task #2 as done",
        "expected_tool": "complete_task",
        "expected_args": {"task_id": 2},
        "is_ambiguous": False,
    },
    {
        "sentence": "I finished task 3",
        "expected_tool": "complete_task",
        "expected_args": {"task_id": 3},
        "is_ambiguous": False,
    },

    # 21-23: Snooze Task variations
    {
        "sentence": "Snooze task 1 for 30 minutes",
        "expected_tool": "snooze_task",
        "expected_args": {"task_id": 1, "duration_minutes": 30},
        "is_ambiguous": False,
    },
    {
        "sentence": "Delay task #2 by 2 hours",
        "expected_tool": "snooze_task",
        "expected_args": {"task_id": 2, "duration_minutes": 120},
        "is_ambiguous": False,
    },
    {
        "sentence": "Snooze task 3 until tomorrow at 9am",
        "expected_tool": "snooze_task",
        "expected_args": {"task_id": 3, "has_snooze_until": True},
        "is_ambiguous": False,
    },

    # 24-26: Update Task variations
    {
        "sentence": "Change priority of task 1 to high",
        "expected_tool": "update_task",
        "expected_args": {"task_id": 1, "priority": "high"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Update task 2 title to 'Deploy v2 release'",
        "expected_tool": "update_task",
        "expected_args": {"task_id": 2, "title": "Deploy v2 release"},
        "is_ambiguous": False,
    },
    {
        "sentence": "Reschedule task 1 to Friday at 3pm",
        "expected_tool": "update_task",
        "expected_args": {"task_id": 1, "has_due_date": True},
        "is_ambiguous": False,
    },

    # 27-28: Delete Task (Unconfirmed vs Confirmed)
    {
        "sentence": "Delete task 4",
        "expected_tool": "delete_task",
        "expected_args": {"task_id": 4, "confirmed": False},
        "is_ambiguous": False,
    },
    {
        "sentence": "Yes, confirm delete task 4",
        "expected_tool": "delete_task",
        "expected_args": {"task_id": 4, "confirmed": True},
        "is_ambiguous": False,
    },

    # 29: Search Tasks
    {
        "sentence": "Search for tasks about dentist",
        "expected_tool": "search_tasks",
        "expected_args": {"query": "dentist"},
        "is_ambiguous": False,
    },

    # 30: Task Summary
    {
        "sentence": "Give me a summary of my tasks",
        "expected_tool": "get_summary",
        "expected_args": {"period": "all"},
        "is_ambiguous": False,
    },
]


@pytest.mark.parametrize("benchmark", EVAL_BENCHMARK, ids=[f"sentence_{i+1}" for i in range(len(EVAL_BENCHMARK))])
def test_agent_eval_sentences(db_session, benchmark):
    user = db_session.query(User).first()
    provider = MockLLMProvider()
    agent = AgentLoop(db=db_session, user=user, provider=provider, session_id="eval_test")

    response = agent.process_message(benchmark["sentence"])

    if benchmark["is_ambiguous"]:
        # Ambiguous queries should return a clarifying question without invoking state changes
        assert len(response.tool_calls) == 0
        assert "?" in response.reply
    else:
        assert len(response.tool_calls) >= 1
        tc = response.tool_calls[0]
        assert tc["name"] == benchmark["expected_tool"]

        args = tc["arguments"]
        expected = benchmark.get("expected_args", {})

        if "title_contains" in expected:
            assert expected["title_contains"].lower() in args.get("title", "").lower()
        if "priority" in expected:
            assert args.get("priority") == expected["priority"]
        if "category" in expected:
            assert args.get("category") == expected["category"]
        if "estimated_minutes" in expected:
            assert args.get("estimated_minutes") == expected["estimated_minutes"]
        if "recurrence_rule" in expected:
            assert args.get("recurrence_rule") == expected["recurrence_rule"]
        if "has_due_date" in expected:
            assert args.get("due_date") is not None
        if "date_range" in expected:
            assert args.get("date_range") == expected["date_range"]
        if "status" in expected:
            assert args.get("status") == expected["status"]
        if "task_id" in expected:
            assert args.get("task_id") == expected["task_id"]
        if "duration_minutes" in expected:
            assert args.get("duration_minutes") == expected["duration_minutes"]
        if "has_snooze_until" in expected:
            assert args.get("snooze_until") is not None
        if "title" in expected:
            assert args.get("title") == expected["title"]
        if "confirmed" in expected:
            assert args.get("confirmed") == expected["confirmed"]
        if "query" in expected:
            assert expected["query"].lower() in args.get("query", "").lower()
        if "period" in expected:
            assert args.get("period") == expected["period"]
