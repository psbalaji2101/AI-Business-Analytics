"""LLM provider interface — swap models via the LLM_PROVIDER setting."""
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def complete(self, prompt: str, *, system: str | None = None) -> str:
        """Return a natural-language completion for the given prompt."""
        raise NotImplementedError
