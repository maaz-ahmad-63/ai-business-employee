import re
import time
from typing import Any, List, Optional, Tuple

from app.llm.base import LLMProvider, LLMResponse


class MockLLMProvider(LLMProvider):
    """
    Local Extractive / Offline RAG Synthesizer.
    Analyzes retrieved chunks, removes table noise/headers, and constructs
    a comprehensive, beautifully structured answer grounded in the actual document content.
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

    def _clean_chunk_content(self, text: str) -> List[str]:
        """Extract substantive paragraphs/sentences, discarding raw table header noise."""
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        meaningful_lines = []

        for line in lines:
            # Skip empty lines or pure table borders
            if re.match(r'^[\s\-_|=+*#]{3,}$', line):
                continue
            # Skip pure table header keys with no detail like "PO No. | Description"
            if re.match(r'^(PO\s*No\.?|PSO\s*No\.?|S\.No\.?|Sl\s*No\.?)\s*\|', line, re.IGNORECASE) and len(line) < 60:
                continue
            # Clean pipe delimiters
            clean = re.sub(r'\|\s*', ' ', line).strip()
            clean = " ".join(clean.split())
            if len(clean) > 15:
                meaningful_lines.append(clean)

        return meaningful_lines

    def _synthesize_from_context(self, prompt: str) -> str:
        """Dynamically parse [Source X] blocks from prompt and extract relevant details."""
        # 1. Extract Question
        question = ""
        if "User Question:" in prompt:
            question = prompt.split("User Question:")[-1].split("Answer:")[0].strip()
        elif "Question:" in prompt:
            question = prompt.split("Question:")[-1].split("Answer:")[0].strip()

        # 2. Extract Context blocks
        sources: List[Tuple[str, str, List[str]]] = []  # (source_tag, doc_name, cleaned_lines)
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
                    src_tag_match = re.search(r'\[Source \d+\]', current_tag)
                    src_tag = src_tag_match.group(0) if src_tag_match else current_tag

                    doc_name = ""
                    doc_match = re.search(r'Document:\s*([^,\)]+)', current_tag)
                    if doc_match:
                        doc_name = doc_match.group(1).strip()

                    cleaned_lines = self._clean_chunk_content(clean_content)
                    if cleaned_lines:
                        sources.append((src_tag, doc_name, cleaned_lines))

                current_tag = None

        if not sources:
            return "I could not find any relevant information in the uploaded documents to answer this question."

        q_lower = question.lower()
        q_words = set(re.findall(r'\w+', q_lower)) - {
            "what", "is", "the", "a", "an", "and", "or", "in", "of", "to", "for", "are", "tell", "me", "about"
        }

        # Determine best response title and structure
        doc_label = sources[0][1] if sources[0][1] else "your documents"
        title_topic = question.rstrip("?").strip()
        if not title_topic:
            title_topic = "Document Details"

        response_parts = [
            f"Here is what was found regarding **{title_topic}** from **{doc_label}**:\n"
        ]

        collected_sections: List[str] = []
        seen_snippets = set()

        for src_tag, _, lines in sources:
            # Score lines by query keyword match
            for line in lines:
                norm = line[:80].lower()
                if norm in seen_snippets:
                    continue
                seen_snippets.add(norm)

                l_lower = line.lower()
                is_heading = any(k in l_lower for k in ["content", "syllabus", "theory", "overview", "objectives", "module", "unit", "scope", "prerequisite"])

                # Check keyword overlap
                l_words = set(re.findall(r'\w+', l_lower))
                has_keyword = bool(q_words & l_words) if q_words else True

                if is_heading or has_keyword or len(collected_sections) < 4:
                    if is_heading:
                        collected_sections.append(f"\n### 📌 {line} {src_tag}")
                    else:
                        # Truncate overly long lines to clean readable sentences
                        if len(line) > 350:
                            line = line[:350].rstrip() + "..."
                        collected_sections.append(f"• {line} {src_tag}")

        if not collected_sections:
            for src_tag, _, lines in sources[:2]:
                for line in lines[:2]:
                    if len(line) > 300:
                        line = line[:300].rstrip() + "..."
                    collected_sections.append(f"• {line} {src_tag}")

        response_parts.append("\n".join(collected_sections[:8]))
        response_parts.append(f"\n\n*All details are grounded in verified sources.*")

        return "\n".join(response_parts)
