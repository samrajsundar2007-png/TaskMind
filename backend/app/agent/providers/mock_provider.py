import re
import uuid
from typing import List, Dict, Any
from app.agent.providers.base import BaseLLMProvider, ProviderResponse, ToolCall
from app.agent.date_parser import is_date_ambiguous


class MockLLMProvider(BaseLLMProvider):
    """
    Deterministic rule-based & regex parser mock LLM provider.
    Used for reliable testing, CI/CD, evals, and offline development.
    """

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        system_prompt: str,
    ) -> ProviderResponse:
        # Find latest user message
        user_message = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                user_message = m.get("content", "").strip()
                break

        if not user_message:
            return ProviderResponse(content="How can I assist you with your tasks today?")

        lower = user_message.lower()

        # Check for date ambiguity first
        is_ambig, clarification = is_date_ambiguous(user_message)
        if is_ambig and clarification and not any(k in lower for k in ["list", "show", "search", "find", "summary"]):
            return ProviderResponse(content=clarification)

        tool_calls = []

        # 1. Delete task (Confirmed vs Unconfirmed)
        delete_match = re.search(r'\b(?:delete|remove|cancel)\s+(?:the\s+)?task\s*(?:#|no\.?|id)?\s*(\d+)', lower)
        if delete_match:
            task_id = int(delete_match.group(1))
            is_confirmed = bool(re.search(r'\b(yes|confirm|confirmed|sure|please delete)\b', lower))
            tool_calls.append(ToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                name="delete_task",
                arguments={"task_id": task_id, "confirmed": is_confirmed}
            ))
            return ProviderResponse(tool_calls=tool_calls)

        # 2. Complete / Finish task
        complete_match = re.search(r'\b(?:complete|finish|finished|done|mark done|mark)\s+(?:task\s*(?:#|no\.?|id)?\s*)?(\d+)', lower)
        if complete_match and not any(k in lower for k in ["snooze", "delete"]):
            task_id = int(complete_match.group(1))
            tool_calls.append(ToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                name="complete_task",
                arguments={"task_id": task_id}
            ))
            return ProviderResponse(tool_calls=tool_calls)

        # 3. Snooze task
        snooze_match = re.search(r'\b(?:snooze|delay|postpone)\s+(?:task\s*(?:#|no\.?|id)?\s*)?(\d+)', lower)
        if snooze_match:
            task_id = int(snooze_match.group(1))
            minutes = None
            snooze_until = None

            # Check for duration (e.g., "for 30 minutes", "by 1 hour", "for 2 hours")
            dur_match = re.search(r'(?:for|by)\s+(\d+)\s*(hour|hr|minute|min)s?', lower)
            if dur_match:
                amount = int(dur_match.group(1))
                unit = dur_match.group(2)
                minutes = amount * 60 if "h" in unit else amount
            else:
                # Check for target time (e.g., "until tomorrow at 9am", "until 5pm")
                until_match = re.search(r'(?:until|to)\s+([a-zA-Z0-9\s:]+(?:am|pm|tomorrow|morning|evening|night|afternoon)?)', lower)
                if until_match:
                    snooze_until = until_match.group(1).strip()

            tool_calls.append(ToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                name="snooze_task",
                arguments={
                    "task_id": task_id,
                    "duration_minutes": minutes,
                    "snooze_until": snooze_until,
                }
            ))
            return ProviderResponse(tool_calls=tool_calls)

        # 4. Update / Reschedule task
        update_match = re.search(r'\b(?:update|change|reschedule|edit|set)\b.*?\btask\s*(?:#|no\.?|id)?\s*(\d+)', lower)
        if update_match:
            task_id = int(update_match.group(1))
            args: Dict[str, Any] = {"task_id": task_id}

            # Check priority change
            if "high" in lower:
                args["priority"] = "high"
            elif "low" in lower:
                args["priority"] = "low"
            elif "med" in lower or "medium" in lower:
                args["priority"] = "med"

            # Check category change
            cat_match = re.search(r'category\s+(?:to\s+)?([a-zA-Z]+)', user_message, re.IGNORECASE)
            if cat_match:
                args["category"] = cat_match.group(1).capitalize()

            # Check title change
            title_match = re.search(r'title\s+(?:to\s+)?[\'"]?([^\'"]+)[\'"]?', user_message, re.IGNORECASE)
            if title_match:
                args["title"] = title_match.group(1).strip()

            # Check due date / reschedule
            resched_match = re.search(r'(?:to|due|at|for)\s+([a-zA-Z0-9\s:]+(?:am|pm|tomorrow|friday|monday|tuesday|wednesday|thursday|saturday|sunday))', lower)
            if resched_match and "category" not in resched_match.group(1) and "title" not in resched_match.group(1) and "priority" not in resched_match.group(1):
                args["due_date"] = resched_match.group(1).strip()

            tool_calls.append(ToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                name="update_task",
                arguments=args
            ))
            return ProviderResponse(tool_calls=tool_calls)

        # 5. Search tasks
        search_match = re.search(r'\b(?:search|find|lookup)\s+(?:for\s+)?(?:tasks?\s+(?:about|with|matching|for)\s+)?[\'"]?([a-zA-Z0-9\s\-_]+)[\'"]?', lower)
        if search_match and not any(k in lower for k in ["list", "show all", "summary"]):
            query = search_match.group(1).strip()
            # Clean filler words
            query = re.sub(r'^(tasks?\s+about|tasks?\s+for|task)\s+', '', query)
            if query:
                tool_calls.append(ToolCall(
                    id=f"call_{uuid.uuid4().hex[:8]}",
                    name="search_tasks",
                    arguments={"query": query}
                ))
                return ProviderResponse(tool_calls=tool_calls)

        # 6. Task Summary
        if any(k in lower for k in ["summary", "overview", "how is my schedule", "stats", "status report"]):
            tool_calls.append(ToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                name="get_summary",
                arguments={"period": "all"}
            ))
            return ProviderResponse(tool_calls=tool_calls)

        # 7. List / Filter tasks
        if any(k in lower for k in ["list", "show", "what are my", "view tasks", "get tasks"]):
            args = {}
            if "today" in lower:
                args["date_range"] = "today"
            elif "tomorrow" in lower:
                args["date_range"] = "tomorrow"
            elif "this week" in lower:
                args["date_range"] = "this_week"
            elif "overdue" in lower:
                args["date_range"] = "overdue"
            elif "upcoming" in lower:
                args["date_range"] = "upcoming"

            if "high priority" in lower or "urgent" in lower or "priority high" in lower:
                args["priority"] = "high"
            elif "low priority" in lower or "priority low" in lower:
                args["priority"] = "low"

            if "done" in lower or "completed" in lower:
                args["status"] = "done"
            elif "pending" in lower or "todo" in lower:
                args["status"] = "pending"

            cat_match = re.search(r'(?:in|for|category)\s+(work|personal|health|finance|shopping)', lower)
            if cat_match:
                args["category"] = cat_match.group(1).capitalize()

            tool_calls.append(ToolCall(
                id=f"call_{uuid.uuid4().hex[:8]}",
                name="list_tasks",
                arguments=args
            ))
            return ProviderResponse(tool_calls=tool_calls)

        # 8. Add task (Default for creation requests)
        title = user_message
        due_date = None
        priority = "med"
        category = None
        estimated_minutes = None
        recurrence_rule = None

        # Clean "add task", "remind me to", "create task", "remember to" prefixes
        title = re.sub(r'^(?:please\s+)?(?:add\s+(?:a\s+)?task\s+(?:to\s+)?|remind\s+me\s+to\s+|create\s+(?:a\s+)?task\s+(?:to\s+)?|remember\s+to\s+|i\s+need\s+to\s+|schedule\s+)', '', title, flags=re.IGNORECASE).strip()

        # Extract priority (e.g., "priority high", "urgent", "high priority", "low priority")
        if re.search(r'\b(priority\s+high|urgent|high\s+priority|asap|important)\b', title, re.IGNORECASE):
            priority = "high"
            title = re.sub(r'\b(?:with\s+)?(?:priority\s+high|urgent|high\s+priority|asap|important)\b', '', title, flags=re.IGNORECASE).strip()
        elif re.search(r'\b(priority\s+low|low\s+priority)\b', title, re.IGNORECASE):
            priority = "low"
            title = re.sub(r'\b(?:with\s+)?(?:priority\s+low|low\s+priority)\b', '', title, flags=re.IGNORECASE).strip()
        elif re.search(r'\b(priority\s+med(?:ium)?|med(?:ium)?\s+priority)\b', title, re.IGNORECASE):
            priority = "med"
            title = re.sub(r'\b(?:with\s+)?(?:priority\s+med(?:ium)?|med(?:ium)?\s+priority)\b', '', title, flags=re.IGNORECASE).strip()

        # Extract category
        cat_match = re.search(r'\b(?:category|tag|in)\s+([a-zA-Z]+)\b', title, re.IGNORECASE)
        if cat_match and cat_match.group(1).lower() in ["work", "personal", "health", "finance", "shopping", "fitness"]:
            category = cat_match.group(1).capitalize()
            title = re.sub(r'\b(?:category|tag|in)\s+' + cat_match.group(1) + r'\b', '', title, flags=re.IGNORECASE).strip()

        # Extract duration
        dur_match = re.search(r'\b(?:for|estimated|takes?)\s+(\d+)\s*(?:min|minute|hour|hr)s?\b', title, re.IGNORECASE)
        if dur_match:
            amt = int(dur_match.group(1))
            estimated_minutes = amt * 60 if "h" in dur_match.group(0).lower() else amt
            title = re.sub(r'\b(?:for|estimated|takes?)\s+\d+\s*(?:min|minute|hour|hr)s?\b', '', title, flags=re.IGNORECASE).strip()

        # Extract recurrence
        if re.search(r'\b(every day|daily|every morning)\b', title, re.IGNORECASE):
            recurrence_rule = "FREQ=DAILY"
            title = re.sub(r'\b(every day|daily|every morning)\b', '', title, flags=re.IGNORECASE).strip()
        elif re.search(r'\b(every week|weekly|every monday)\b', title, re.IGNORECASE):
            recurrence_rule = "FREQ=WEEKLY"
            title = re.sub(r'\b(every week|weekly|every monday)\b', '', title, flags=re.IGNORECASE).strip()

        # Extract due date expression
        date_patterns = [
            r'\b(?:on|at|by|due)\s+([a-zA-Z0-9\s:]+(?:am|pm|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?)$',
            r'\b(tomorrow\s+(?:morning|afternoon|evening|night|\d{1,2}(?::\d{2})?\s*(?:am|pm)?))\b',
            r'\b(tomorrow|tonight|today)\b',
            r'\b(in\s+\d+\s+(?:minutes?|hours?|days?))\b',
            r'\b(next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\b',
        ]

        for pat in date_patterns:
            d_match = re.search(pat, title, re.IGNORECASE)
            if d_match:
                due_date = d_match.group(1 if len(d_match.groups()) > 0 else 0).strip()
                title = title[:d_match.start()].strip()
                break

        # Clean trailing punctuation
        title = title.strip(" .,-")
        if not title:
            title = "New Task"

        tool_calls.append(ToolCall(
            id=f"call_{uuid.uuid4().hex[:8]}",
            name="add_task",
            arguments={
                "title": title,
                "due_date": due_date,
                "priority": priority,
                "category": category,
                "estimated_minutes": estimated_minutes,
                "recurrence_rule": recurrence_rule,
            }
        ))

        return ProviderResponse(tool_calls=tool_calls)
