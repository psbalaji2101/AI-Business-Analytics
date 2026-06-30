"""Mock LLM provider — templated narration so AI features work without API keys.

The real intelligence (numbers, anomalies) is computed deterministically in the
insight engine; this provider only phrases facts into readable sentences.
"""
from app.ai.base import LLMProvider


class MockLLMProvider(LLMProvider):
    name = "mock"

    async def complete(self, prompt: str, *, system: str | None = None) -> str:
        # The insight engine passes a fully-formed fact summary as the prompt.
        # The mock simply returns it, lightly framed, simulating an LLM narration.
        return prompt.strip()
