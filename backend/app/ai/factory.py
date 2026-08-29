"""LLM provider factory."""
from app.ai.base import LLMProvider
from app.ai.mock_provider import MockLLMProvider
from app.core.config import settings

_PROVIDERS: dict[str, type[LLMProvider]] = {
    "mock": MockLLMProvider,
    # "openai": OpenAIProvider,      # added in Phase 6
    # "anthropic": AnthropicProvider,
}


def get_llm() -> LLMProvider:
    provider_cls = _PROVIDERS.get(settings.llm_provider, MockLLMProvider)
    return provider_cls()
