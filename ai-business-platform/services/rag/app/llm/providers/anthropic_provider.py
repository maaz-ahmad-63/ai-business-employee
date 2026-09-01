import time
from typing import Any, Optional
import httpx

from app.core.config import settings
from app.llm.base import LLMProvider, LLMResponse


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ):
        self.api_key = api_key or settings.llm_api_key
        self.model = model or settings.llm_model or "claude-3-5-sonnet-20241022"
        self.base_url = (base_url or settings.llm_api_base or "https://api.anthropic.com/v1").rstrip("/")
        self.temperature = temperature if temperature is not None else settings.llm_temperature
        self.max_tokens = max_tokens or settings.llm_max_tokens

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        t0 = time.perf_counter()

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key or "",
            "anthropic-version": "2023-06-01",
        }

        payload: dict = {
            "model": self.model,
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": temperature if temperature is not None else self.temperature,
            "messages": [{"role": "user", "content": prompt}],
            **kwargs,
        }
        if system_prompt:
            payload["system"] = system_prompt

        url = f"{self.base_url}/messages"
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        content_blocks = data.get("content", [])
        text_parts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
        content = "".join(text_parts)
        usage = data.get("usage", {})

        return LLMResponse(
            content=content,
            token_usage={
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
            },
            model=data.get("model", self.model),
            provider="anthropic",
            latency_ms=latency_ms,
        )
