import time
from typing import Any, Optional

from app.llm.base import LLMProvider, LLMResponse


class MockLLMProvider(LLMProvider):
    """Deterministic Mock LLM Provider for tests and offline usage."""

    def __init__(self, default_response: Optional[str] = None):
        self.default_response = default_response or "Based on the provided context, Maaz is a computer science student [Source 1]."

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        t0 = time.perf_counter()

        response_text = self.default_response
        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        return LLMResponse(
            content=response_text,
            token_usage={
                "prompt_tokens": len(prompt.split()) + (len(system_prompt.split()) if system_prompt else 0),
                "completion_tokens": len(response_text.split()),
                "total_tokens": len(prompt.split()) + len(response_text.split()),
            },
            model="mock-model",
            provider="mock",
            latency_ms=latency_ms,
        )
