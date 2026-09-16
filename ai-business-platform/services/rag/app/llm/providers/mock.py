import re
import time
from typing import Any, List, Optional, Tuple

from app.llm.base import LLMProvider, LLMResponse


class MockLLMProvider(LLMProvider):
    """
    Local Extractive / Mock LLM Provider.
    When no hardcoded default_response is provided, it dynamically analyzes
    the retrieved RAG context and synthesizes grounded answers with citations.
    """

    def __init__(self, default_response: Optional[str] = None):
        self._default_response = default_response

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        t0 = time.perf_counter()

        if self._default_response:
            response_text = self._default_response
        else:
            response_text = self._synthesize_from_context(prompt)

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

    def _synthesize_from_context(self, prompt: str) -> str:
        """Dynamically parse [Source X] blocks from prompt and extract relevant details."""
        # 1. Extract Question
        question = ""
        if "User Question:" in prompt:
            question = prompt.split("User Question:")[-1].split("Answer:")[0].strip()
        elif "Question:" in prompt:
            question = prompt.split("Question:")[-1].split("Answer:")[0].strip()

        # 2. Extract Context blocks
        sources: List[Tuple[str, str]] = []  # (tag_with_doc, content)
        raw_blocks = re.split(r'(\[Source \d+\][^\n]*)', prompt)
        current_tag = None

        for b in raw_blocks:
            b = b.strip()
            if not b:
                continue
            if b.startswith("[Source"):
                current_tag = b
            elif current_tag:
                clean_content = b.split("----------------------------------------")[0]
                clean_content = clean_content.split("User Question:")[0].strip()
                if clean_content:
                    sources.append((current_tag, clean_content))
                current_tag = None

        if not sources:
            return "I could not find any relevant information in the uploaded documents to answer this question."

        # 3. Construct intelligent grounded response with exact citations
        q_lower = question.lower()
        q_words = set(re.findall(r'\w+', q_lower)) - {
            "what", "is", "the", "a", "an", "and", "or", "in", "of", "to", "for", "are", "tell", "me", "about"
        }

        lines = [f"Based on the retrieved context from your documents:"]

        # Sort sources by relevance to query words if any
        scored_sources = []
        for tag, content in sources:
            c_words = set(re.findall(r'\w+', content.lower()))
            overlap = len(c_words & q_words) if q_words else 1
            scored_sources.append((overlap, tag, content))

        scored_sources.sort(key=lambda x: x[0], reverse=True)

        for _, tag, content in scored_sources[:3]:
            # Extract bracket tag like [Source 1]
            src_tag = tag.split("(")[0].strip() if "(" in tag else tag
            doc_info = tag[len(src_tag):].strip()

            # Clean and truncate long chunks to salient text
            paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
            relevant_text = paragraphs[0] if paragraphs else content
            if len(relevant_text) > 350:
                relevant_text = relevant_text[:350].rstrip() + "..."

            lines.append(f"\n• According to **{src_tag}** {doc_info}:\n  {relevant_text}")

        return "\n".join(lines)
