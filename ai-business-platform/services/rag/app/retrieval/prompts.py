from typing import Any, Dict, List, Tuple

RAG_SYSTEM_PROMPT = """You are an accurate, reliable enterprise AI assistant for an enterprise multi-tenant RAG platform.

Instructions:
1. Answer the user's question using ONLY the provided context sources.
2. If the context does not contain enough information to answer the question faithfully, state clearly and concisely: "I do not have enough information in the provided documents to answer this question."
3. Do NOT make up facts, hallucinate, or extrapolate beyond the explicit facts in the context.
4. Cite your sources in the text using bracketed citations, e.g. [Source 1], [Source 2].
5. Keep your answer clear, direct, and well-structured.
"""


def build_context_and_citations(
    chunks: List[Dict[str, Any]],
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Format retrieved chunks into indexed context for the LLM prompt
    and build structured citation source metadata.
    """
    context_blocks: List[str] = []
    sources: List[Dict[str, Any]] = []

    for idx, chunk in enumerate(chunks, start=1):
        chunk_id = str(chunk.get("id", ""))
        doc_id = str(chunk.get("document_id", ""))
        meta = chunk.get("metadata", {}) or {}
        content = chunk.get("content", "").strip()

        filename = meta.get("filename") or meta.get("source") or "document"
        page = meta.get("page")  # integer page if available, else None

        source_label = f"Source {idx}"
        loc_str = f"Document: {filename}"
        if page is not None:
            loc_str += f", Page: {page}"

        block = f"[{source_label}] ({loc_str})\n{content}"
        context_blocks.append(block)

        source_info = {
            "source_id": idx,
            "chunk_id": chunk_id,
            "document_id": doc_id,
            "filename": filename,
            "page": page,
            "content": content,
            "metadata": meta,
        }
        sources.append(source_info)

    formatted_context = "\n\n".join(context_blocks)
    return formatted_context, sources


def build_rag_user_prompt(query: str, formatted_context: str) -> str:
    """Build user prompt combining context and user query."""
    if not formatted_context.strip():
        return f"User Question: {query}\n\nContext:\nNo relevant context documents were found."

    return (
        f"Context Sources:\n"
        f"----------------------------------------\n"
        f"{formatted_context}\n"
        f"----------------------------------------\n\n"
        f"User Question: {query}\n"
        f"Answer:"
    )
