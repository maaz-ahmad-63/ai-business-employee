import pytest
from app.chunking.chunker import TextChunker, clean_text


def test_clean_text_removes_control_chars_and_normalizes_spaces():
    raw = "Hello\x00 world!\r\n\r\nThis   is   a   test.\n\n\n\nAnother paragraph."
    cleaned = clean_text(raw)

    assert "\x00" not in cleaned
    assert "\r" not in cleaned
    assert "This is a test." in cleaned
    assert "\n\n\n" not in cleaned


def test_text_chunker_splits_paragraphs():
    text = (
        "Paragraph one is relatively short.\n\n"
        "Paragraph two contains important details about machine learning and vector indexing.\n\n"
        "Paragraph three summarizes the findings."
    )
    chunker = TextChunker(chunk_size=100, chunk_overlap=20)
    chunks = chunker.chunk_text(text, base_metadata={"doc": "test"})

    assert len(chunks) >= 2
    for idx, c in enumerate(chunks):
        assert c["chunk_index"] == idx
        assert c["metadata"]["doc"] == "test"
        assert c["metadata"]["chunk_index"] == idx
        assert len(c["content"]) <= 120  # chunk_size margin


def test_text_chunker_empty_input():
    chunker = TextChunker()
    assert chunker.chunk_text("") == []
    assert chunker.chunk_text("   \n\n  ") == []


def test_text_chunker_invalid_overlap():
    with pytest.raises(ValueError):
        TextChunker(chunk_size=100, chunk_overlap=100)
