import logging
from typing import Optional

from app.core.config import settings
from app.llm.base import LLMProvider
from app.llm.providers.anthropic_provider import AnthropicProvider
from app.llm.providers.gemini_provider import GeminiProvider
from app.llm.providers.mock import MockLLMProvider
from app.llm.providers.ollama_provider import OllamaProvider
from app.llm.providers.openai_provider import OpenAIProvider

logger = logging.getLogger(__name__)


def get_llm_provider(
    provider_name: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    api_base: Optional[str] = None,
) -> Optional[LLMProvider]:
    """
    Factory to retrieve configured LLM provider instance.
    Returns None if no provider is configured.
    """
    p_name = (provider_name or settings.llm_provider or "").lower().strip()
    if not p_name:
        return None

    if p_name == "mock":
        return MockLLMProvider()
    elif p_name in ("openai", "azure", "groq", "together"):
        return OpenAIProvider(
            api_key=api_key or settings.llm_api_key,
            model=model or settings.llm_model,
            base_url=api_base or settings.llm_api_base,
        )
    elif p_name == "anthropic":
        return AnthropicProvider(
            api_key=api_key or settings.llm_api_key,
            model=model or settings.llm_model,
            base_url=api_base or settings.llm_api_base,
        )
    elif p_name in ("gemini", "google"):
        return GeminiProvider(
            api_key=api_key or settings.llm_api_key,
            model=model or settings.llm_model,
        )
    elif p_name == "ollama":
        return OllamaProvider(
            base_url=api_base or settings.llm_api_base,
            model=model or settings.llm_model,
        )
    else:
        logger.warning(f"Unknown LLM provider configured: {p_name}")
        return None
