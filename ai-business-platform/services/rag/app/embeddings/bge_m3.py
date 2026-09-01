import logging
import threading
from typing import List, Optional

from app.core.config import settings
from app.embeddings.embedder import BaseEmbeddingService

logger = logging.getLogger(__name__)


class BGEEmbeddingService(BaseEmbeddingService):
    """BGE-M3 local embedding service using sentence-transformers."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        dimension: Optional[int] = None,
        normalize: Optional[bool] = None,
        device: Optional[str] = None,
        batch_size: Optional[int] = None,
    ):
        self.model_name = model_name or settings.embedding_model
        self._expected_dimension = dimension or settings.embedding_dimension
        self.normalize = normalize if normalize is not None else settings.embedding_normalize
        self.device = device or settings.embedding_device
        self.batch_size = batch_size or settings.embedding_batch_size
        self._model = None
        self._lock = threading.Lock()

    @property
    def dimension(self) -> int:
        return self._expected_dimension

    def _get_model(self):
        """Lazy-loads and caches the SentenceTransformer model."""
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from sentence_transformers import SentenceTransformer

                    logger.info(f"Loading embedding model: {self.model_name} on device: {self.device}")
                    kwargs = {}
                    if self.device:
                        kwargs["device"] = self.device
                    self._model = SentenceTransformer(self.model_name, **kwargs)
                    logger.info(f"Loaded embedding model: {self.model_name}")
        return self._model

    def embed(self, text: str) -> List[float]:
        """Embed a single text string."""
        if not isinstance(text, str):
            text = str(text)

        model = self._get_model()
        vector = model.encode(
            text,
            normalize_embeddings=self.normalize,
            show_progress_bar=False,
        )

        embedding = vector.tolist() if hasattr(vector, "tolist") else list(vector)
        if len(embedding) != self._expected_dimension:
            raise ValueError(
                f"Embedding dimension mismatch: expected {self._expected_dimension}, got {len(embedding)}"
            )
        return embedding

    def embed_many(self, texts: List[str], batch_size: Optional[int] = None) -> List[List[float]]:
        """Embed a batch of texts."""
        if not texts:
            return []

        clean_texts = [str(t) for t in texts]
        model = self._get_model()
        bs = batch_size or self.batch_size

        vectors = model.encode(
            clean_texts,
            batch_size=bs,
            normalize_embeddings=self.normalize,
            show_progress_bar=False,
        )

        embeddings = vectors.tolist() if hasattr(vectors, "tolist") else [list(v) for v in vectors]
        for emb in embeddings:
            if len(emb) != self._expected_dimension:
                raise ValueError(
                    f"Embedding dimension mismatch: expected {self._expected_dimension}, got {len(emb)}"
                )
        return embeddings


# Singleton instance
embedding_service = BGEEmbeddingService()


def get_embedding_service() -> BaseEmbeddingService:
    """Dependency injection helper for embedding service."""
    return embedding_service
