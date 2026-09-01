import pytest
from app.llm.base import LLMResponse
from app.llm.providers.factory import get_llm_provider
from app.llm.providers.mock import MockLLMProvider
from app.retrieval.prompts import (
    build_context_and_citations,
    build_rag_user_prompt,
)


def test_mock_llm_provider():
    provider = MockLLMProvider(default_response="Maaz studies Computer Science [Source 1].")
    resp: LLMResponse = provider.generate(prompt="What does Maaz study?")

    assert resp.content == "Maaz studies Computer Science [Source 1]."
    assert resp.provider == "mock"
    assert resp.model == "mock-model"
    assert resp.token_usage["total_tokens"] > 0
    assert resp.latency_ms >= 0


def test_llm_provider_factory():
    mock_p = get_llm_provider("mock")
    assert isinstance(mock_p, MockLLMProvider)

    none_p = get_llm_provider(None)
    assert none_p is None


def test_build_context_and_citations():
    chunks = [
        {
            "id": "c1",
            "document_id": "d1",
            "content": "Page 1 info.",
            "metadata": {"filename": "guide.pdf", "page": 1},
        },
        {
            "id": "c2",
            "document_id": "d2",
            "content": "Doc 2 text.",
            "metadata": {"filename": "notes.txt"},
        },
    ]

    context, citations = build_context_and_citations(chunks)

    assert "[Source 1] (Document: guide.pdf, Page: 1)" in context
    assert "[Source 2] (Document: notes.txt)" in context
    assert len(citations) == 2
    assert citations[0]["source_id"] == 1
    assert citations[0]["page"] == 1
    assert citations[1]["source_id"] == 2
    assert citations[1]["page"] is None  # Not fabricated!


def test_build_rag_user_prompt():
    prompt = build_rag_user_prompt("What is AI?", "Source 1 content")
    assert "Context Sources:" in prompt
    assert "User Question: What is AI?" in prompt
