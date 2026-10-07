from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.user import User
from app.agent.tools_schema import AGENT_TOOLS
from app.agent.prompts import build_system_prompt
from app.agent.tool_executor import ToolExecutor
from app.agent.providers.base import BaseLLMProvider
from app.agent.providers.factory import get_llm_provider
from app.agent.memory import get_conversation_history, add_message_to_history


class AgentResponse:
    def __init__(
        self,
        reply: str,
        tool_calls: List[Dict[str, Any]],
        requires_confirmation: bool = False,
        session_id: str = "default",
    ):
        self.reply = reply
        self.tool_calls = tool_calls
        self.requires_confirmation = requires_confirmation
        self.session_id = session_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reply": self.reply,
            "tool_calls": self.tool_calls,
            "requires_confirmation": self.requires_confirmation,
            "session_id": self.session_id,
        }


class AgentLoop:
    def __init__(
        self,
        db: Session,
        user: User,
        provider: Optional[BaseLLMProvider] = None,
        session_id: Optional[str] = None,
    ):
        self.db = db
        self.user = user
        self.provider = provider or get_llm_provider()
        self.session_id = session_id or f"user_{user.id}"
        self.executor = ToolExecutor(db, user)

    def process_message(self, user_message: str) -> AgentResponse:
        user_message_clean = user_message.strip()
        if not user_message_clean:
            return AgentResponse(
                reply="Please enter a message or command.",
                tool_calls=[],
                session_id=self.session_id,
            )

        # 1. Fetch recent conversation history
        history = get_conversation_history(self.session_id, max_messages=8)

        # 2. Build system prompt with time and timezone context
        system_prompt = build_system_prompt(
            user_tz_str=self.user.timezone or "UTC",
            base_time_utc=datetime.now(timezone.utc),
        )

        # 3. Assemble full message list
        messages = history + [{"role": "user", "content": user_message_clean}]

        # 4. Generate LLM response
        llm_resp = self.provider.generate_response(
            messages=messages,
            tools=AGENT_TOOLS,
            system_prompt=system_prompt,
        )

        executed_tools = []
        requires_confirmation = False
        tool_messages = []

        # 5. Execute tool calls if any
        if llm_resp.tool_calls:
            for tc in llm_resp.tool_calls:
                result = self.executor.execute(tc.name, tc.arguments)
                executed_tools.append({
                    "id": tc.id,
                    "name": tc.name,
                    "arguments": tc.arguments,
                    "result": result.to_dict(),
                })
                tool_messages.append(result.message)
                if result.requires_confirmation:
                    requires_confirmation = True

        # 6. Formulate concise reply (1-2 sentences)
        if tool_messages:
            final_reply = " ".join(tool_messages)
        elif llm_resp.content:
            final_reply = llm_resp.content
        else:
            final_reply = "I've processed your request."

        # 7. Save to conversation memory
        add_message_to_history(self.session_id, "user", user_message_clean)
        add_message_to_history(
            self.session_id,
            "assistant",
            final_reply,
            tool_calls=[tc.model_dump() for tc in llm_resp.tool_calls] if llm_resp.tool_calls else None,
        )

        return AgentResponse(
            reply=final_reply,
            tool_calls=executed_tools,
            requires_confirmation=requires_confirmation,
            session_id=self.session_id,
        )
