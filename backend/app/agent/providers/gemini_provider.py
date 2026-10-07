import httpx
from typing import List, Dict, Any
from app.config import settings
from app.agent.providers.base import BaseLLMProvider, ProviderResponse, ToolCall


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str = "", model: str = "gemini-2.0-flash"):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model

    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        system_prompt: str,
    ) -> ProviderResponse:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not set.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        # Convert tool format to Gemini declarations
        gemini_function_declarations = []
        for t in tools:
            fn = t["function"]
            gemini_function_declarations.append({
                "name": fn["name"],
                "description": fn["description"],
                "parameters": fn.get("parameters", {}),
            })

        # Format conversation contents
        contents = []
        for m in messages:
            role = "user" if m.get("role") in ["user", "system"] else "model"
            contents.append({
                "role": role,
                "parts": [{"text": str(m.get("content", ""))}]
            })

        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": contents,
            "tools": [{"function_declarations": gemini_function_declarations}],
        }

        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        candidates = data.get("candidates", [])
        if not candidates:
            return ProviderResponse(content="I could not process your request.")

        first_candidate = candidates[0]
        content_parts = first_candidate.get("content", {}).get("parts", [])

        text_content = ""
        tool_calls = []

        for part in content_parts:
            if "text" in part:
                text_content += part["text"]
            if "functionCall" in part:
                fc = part["functionCall"]
                tool_calls.append(ToolCall(
                    id=f"gemini_call_{len(tool_calls)+1}",
                    name=fc["name"],
                    arguments=fc.get("args", {}),
                ))

        return ProviderResponse(
            content=text_content.strip() if text_content else None,
            tool_calls=tool_calls,
            finish_reason=first_candidate.get("finishReason"),
        )
