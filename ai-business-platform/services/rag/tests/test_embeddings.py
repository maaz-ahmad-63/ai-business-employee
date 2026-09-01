import math
import pytest
from app.embeddings.bge_m3 import BGEEmbeddingService, embedding_service


def test_bge_m3_embedding_dimension():
    """Verify BGE-M3 generates exactly 1024-dimensional embeddings."""
    text = "Artificial intelligence and retrieval augmented generation."
    vector = embedding_service.embed(text)

    assert isinstance(vector, list)
    assert len(vector) == 1024
    assert all(isinstance(x, float) for x in vector)


def test_bge_m3_normalized_embeddings():
    """Verify generated embeddings are L2 normalized (unit length)."""
    text = "Testing normalization of vector embeddings."
    vector = embedding_service.embed(text)

    l2_norm = math.sqrt(sum(x * x for x in vector))
    assert math.isclose(l2_norm, 1.0, rel_tol=1e-3)


def test_bge_m3_batch_embeddings():
    """Verify batch embedding produces correct count and dimensions."""
    texts = [
        "First document paragraph.",
        "Second document paragraph with more details.",
        "Third document paragraph about AI business platform.",
    ]
    vectors = embedding_service.embed_many(texts)

    assert len(vectors) == 3
    for v in vectors:
        assert len(v) == 1024


def test_bge_m3_lazy_loading():
    """Verify new service instance does not load model until embed() is called."""
    service = BGEEmbeddingService()
    assert service._model is None
    vec = service.embed("Trigger lazy load")
    assert service._model is not None
    assert len(vec) == 1024
