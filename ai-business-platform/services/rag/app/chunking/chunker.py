import re
import unicodedata
from typing import Any, Dict, List, Optional

from app.core.config import settings


def clean_text(text: str) -> str:
    """Clean and normalize raw text."""
    if not text:
        return ""

    # Normalize Unicode characters (NFKC)
    text = unicodedata.normalize("NFKC", text)

    # Replace null bytes and control characters (except tab and newline)
    text = "".join(ch for ch in text if ch in ("\n", "\r", "\t") or unicodedata.category(ch)[0] != "C")

    # Standardize newline characters
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Replace multi-spaces/tabs on individual lines without destroying newlines
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]

    # Collapse more than 2 consecutive newlines into 2
    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    return cleaned


class TextChunker:
    """Recursive separator-aware text chunker with overlap."""

    DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""]

    def __init__(
        self,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        separators: Optional[List[str]] = None,
    ):
        self.chunk_size = chunk_size if chunk_size is not None else settings.chunk_size
        self.chunk_overlap = chunk_overlap if chunk_overlap is not None else settings.chunk_overlap
        self.separators = separators or self.DEFAULT_SEPARATORS

        if self.chunk_overlap >= self.chunk_size:
            raise ValueError(f"chunk_overlap ({self.chunk_overlap}) must be smaller than chunk_size ({self.chunk_size})")

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        """Recursively split text using hierarchy of separators."""
        final_chunks: List[str] = []
        separator = separators[-1]
        new_separators = []

        for i, sep in enumerate(separators):
            if sep == "":
                separator = ""
                break
            if sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break

        splits = text.split(separator) if separator else list(text)

        good_splits: List[str] = []
        for s in splits:
            if not s:
                continue
            if len(s) < self.chunk_size:
                good_splits.append(s)
            else:
                if new_separators:
                    other_info = self._split_text(s, new_separators)
                    good_splits.extend(other_info)
                else:
                    good_splits.append(s)

        # Merge small splits up to chunk_size with chunk_overlap
        merged_chunks = self._merge_splits(good_splits, separator)
        final_chunks.extend(merged_chunks)
        return final_chunks

    def _merge_splits(self, splits: List[str], separator: str) -> List[str]:
        """Merge adjacent splits into chunks respecting size and overlap."""
        docs: List[str] = []
        current_doc: List[str] = []
        total_len = 0

        sep_len = len(separator)

        for split in splits:
            split_len = len(split)
            addition_len = split_len + (sep_len if current_doc else 0)

            if total_len + addition_len > self.chunk_size:
                if total_len > 0:
                    merged = separator.join(current_doc).strip()
                    if merged:
                        docs.append(merged)

                    # Account for overlap: keep splits from end until overlap is satisfied
                    while total_len > self.chunk_overlap and current_doc:
                        removed = current_doc.pop(0)
                        total_len -= len(removed) + (sep_len if current_doc else 0)

                current_doc.append(split)
                total_len += split_len + (sep_len if len(current_doc) > 1 else 0)
            else:
                current_doc.append(split)
                total_len += addition_len

        if current_doc:
            merged = separator.join(current_doc).strip()
            if merged:
                docs.append(merged)

        return docs

    def chunk_text(
        self,
        text: str,
        base_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Clean and split text into indexed chunks with metadata."""
        cleaned = clean_text(text)
        if not cleaned:
            return []

        raw_chunks = self._split_text(cleaned, self.separators)
        results: List[Dict[str, Any]] = []

        for idx, chunk_content in enumerate(raw_chunks):
            chunk_content = chunk_content.strip()
            if not chunk_content:
                continue

            chunk_meta = dict(base_metadata or {})
            chunk_meta["chunk_index"] = idx
            chunk_meta["char_count"] = len(chunk_content)

            results.append({
                "chunk_index": idx,
                "content": chunk_content,
                "metadata": chunk_meta,
            })

        return results
