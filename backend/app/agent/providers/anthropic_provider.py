import httpx
from typing import List, Dict, Any
from app.config import settings
from app.agent.providers.base import BaseLLMProvider, ProviderResponse, ToolCall


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str = "", model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.model = model
        self.api_url = "https://api.anthropic.com/v1/messages"

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        system_prompt: str,
    ) -> ProviderResponse:
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set.")

        # Convert tool format to Anthropic tool definitions
        anthropic_tools = []
        for t in tools:
            fn = t["function"]
            anthropic_tools.append({
                "name": fn["name"],
                "description": fn["description"],
                "input_schema": fn.get("parameters", {}),
            })

        formatted_messages = []
        for m in messages:
            if m.get("role") in ["user", "assistant"]:
                formatted_messages.append({
                    "role": m["role"],
                    "content": m["content"],
                })

        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": formatted_messages,
            "tools": anthropic_tools,
        }

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=30.0) as client:
            response = client.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        content_blocks = data.get("content", [])
        text_content = ""
        tool_calls = []

        for block in content_blocks:
            if block.get("type") == "text":
                text_content += block.get("text", "")
            elif block.get("type") == "tool_use":
                tool_calls.append(ToolCall(
                    id=block.get("id"),
                    name=block.get("name"),
                    arguments=block.get("input", {}),
                ))

        return ProviderResponse(
            content=text_content.strip() if text_content else None,
            tool_calls=tool_calls,
            finish_reason=data.get("stop_reason"),
        )
