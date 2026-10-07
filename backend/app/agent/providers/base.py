from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: Dict[str, Any]


class ProviderResponse(BaseModel):
    content: Optional[str] = None
    tool_calls: List[ToolCall] = []
    finish_reason: Optional[str] = None


class BaseLLMProvider(ABC):
    @abstractmethod
    def generate_response(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        system_prompt: str,
    ) -> ProviderResponse:
        """Generate response from LLM provider given messages and tool definitions."""
        pass
