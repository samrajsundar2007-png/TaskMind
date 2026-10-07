from typing import List, Dict, Any

AGENT_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "add_task",
            "description": "Add a new task or reminder with optional due date, priority, category, estimated duration, or recurrence.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Clear title and action of the task (e.g., 'Submit quarterly tax report', 'Call Dr. Smith')."
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Natural language date/time or ISO string (e.g. 'tomorrow at 5pm', 'in 2 hours', 'Friday 9am', '2026-10-15T14:00:00Z')."
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "med", "high"],
                        "description": "Priority level of the task. Default is 'med'."
                    },
                    "category": {
                        "type": "string",
                        "description": "Category or project tag (e.g., 'Work', 'Personal', 'Health', 'Finance', 'Shopping')."
                    },
                    "estimated_minutes": {
                        "type": "integer",
                        "description": "Estimated duration to complete the task in minutes (e.g., 30)."
                    },
                    "recurrence_rule": {
                        "type": "string",
                        "description": "Recurrence pattern if recurring (e.g. 'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO', 'daily', 'every Monday')."
                    }
                },
                "required": ["title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "List and filter tasks by status, priority, category, or date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["pending", "done", "snoozed", "cancelled"],
                        "description": "Filter by task status. Defaults to showing active/pending tasks."
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "med", "high"],
                        "description": "Filter by task priority."
                    },
                    "category": {
                        "type": "string",
                        "description": "Filter by specific category name."
                    },
                    "date_range": {
                        "type": "string",
                        "enum": ["today", "tomorrow", "this_week", "upcoming", "overdue", "all"],
                        "description": "Date range filter relative to today."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "Update attributes of an existing task by its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "ID of the task to update (must be a valid integer ID)."
                    },
                    "title": {
                        "type": "string",
                        "description": "New title for the task."
                    },
                    "due_date": {
                        "type": "string",
                        "description": "New natural language or ISO date/time."
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "med", "high"],
                        "description": "New priority level."
                    },
                    "category": {
                        "type": "string",
                        "description": "New category name."
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "done", "snoozed", "cancelled"],
                        "description": "New status for the task."
                    },
                    "estimated_minutes": {
                        "type": "integer",
                        "description": "New estimated minutes."
                    }
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark a task as completed/done by its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "The exact ID of the task to complete."
                    }
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "snooze_task",
            "description": "Snooze a task to be reminded at a later time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "The ID of the task to snooze."
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Number of minutes to delay the reminder (e.g. 60 for 1 hour)."
                    },
                    "snooze_until": {
                        "type": "string",
                        "description": "Specific date/time string to snooze until (e.g. 'tomorrow at 9am', 'in 2 hours')."
                    }
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete a task. Requires confirmation flag to actually delete.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "The ID of the task to delete."
                    },
                    "confirmed": {
                        "type": "boolean",
                        "description": "Set to true only if the user has explicitly confirmed deletion."
                    }
                },
                "required": ["task_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_tasks",
            "description": "Search for tasks matching a text query in title, description, or category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keywords or search term."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_summary",
            "description": "Get a statistical summary of user tasks (total, pending, done, overdue, high priority).",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["all", "today", "week", "overdue"],
                        "description": "Scope of the summary."
                    }
                }
            }
        }
    }
]
