from app.config import settings
from app.agent.providers.base import BaseLLMProvider
from app.agent.providers.mock_provider import MockLLMProvider
from app.agent.providers.openai_provider import OpenAIProvider
from app.agent.providers.gemini_provider import GeminiProvider
from app.agent.providers.anthropic_provider import AnthropicProvider


def get_llm_provider(provider_name: str = "") -> BaseLLMProvider:
    name = (provider_name or settings.LLM_PROVIDER).lower().strip()

    if name == "openai":
        return OpenAIProvider()
    elif name in ["gemini", "google"]:
        return GeminiProvider()
    elif name in ["anthropic", "claude"]:
        return AnthropicProvider()
    else:
        return MockLLMProvider()
