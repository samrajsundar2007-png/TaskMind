import json
import httpx
from typing import List, Dict, Any
from app.config import settings
from app.agent.providers.base import BaseLLMProvider, ProviderResponse, ToolCall


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str = "", model: str = "gpt-4o-mini"):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model
        self.api_url = "https://api.openai.com/v1/chat/completions"

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        system_prompt: str,
    ) -> ProviderResponse:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not set.")

        formatted_messages = [{"role": "system", "content": system_prompt}] + messages

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "tools": tools,
            "tool_choice": "auto",
            "temperature": 0.1,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=30.0) as client:
            response = client.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        choice = data["choices"][0]
        message = choice.get("message", {})
        content = message.get("content")

        tool_calls = []
        raw_tool_calls = message.get("tool_calls", [])
        for tc in raw_tool_calls:
            try:
                fn_name = tc["function"]["name"]
                fn_args = json.loads(tc["function"]["arguments"])
                tool_calls.append(ToolCall(
                    id=tc["id"],
                    name=fn_name,
                    arguments=fn_args,
                ))
            except Exception:
                continue

        return ProviderResponse(
            content=content,
            tool_calls=tool_calls,
            finish_reason=choice.get("finish_reason"),
        )
