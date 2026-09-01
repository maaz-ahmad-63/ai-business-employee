import logging
import threading
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class CrossEncoderReranker:
    """Local CrossEncoder reranker using sentence-transformers."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        enabled: Optional[bool] = None,
        candidates_k: Optional[int] = None,
        top_k: Optional[int] = None,
    ):
        self.model_name = model_name or settings.reranker_model
        self.device = device or settings.reranker_device
        self.enabled = enabled if enabled is not None else settings.reranker_enabled
        self.candidates_k = candidates_k or settings.reranker_candidates
        self.top_k = top_k or settings.reranker_top_k
        self._model = None
        self._lock = threading.Lock()

    def _get_model(self):
        """Lazy-load and cache the CrossEncoder model."""
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from sentence_transformers import CrossEncoder

                    logger.info(f"Loading reranker model: {self.model_name} on device: {self.device}")
                    kwargs = {}
                    if self.device:
                        kwargs["device"] = self.device
                    self._model = CrossEncoder(self.model_name, **kwargs)
                    logger.info(f"Loaded reranker model: {self.model_name}")
        return self._model

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Rerank candidate chunks using CrossEncoder.
        Falls back cleanly to input ranking if disabled or if an error occurs.
        """
        k = top_k or self.top_k
        if not candidates:
            return []

        if not self.enabled:
            logger.debug("Reranker is disabled; returning RRF candidates.")
            for c in candidates:
                c.setdefault("rerank_score", None)
            return candidates[:k]

        try:
            # Prepare (query, content) pairs for CrossEncoder
            pairs = [(query, c["content"]) for c in candidates]
            model = self._get_model()
            scores = model.predict(pairs)

            results: List[Dict[str, Any]] = []
            for candidate, score in zip(candidates, scores):
                c_copy = dict(candidate)
                c_copy["rerank_score"] = float(score)
                results.append(c_copy)

            # Sort descending by rerank_score
            results.sort(key=lambda x: x["rerank_score"], reverse=True)
            return results[:k]

        except Exception as exc:
            logger.warning(f"Reranker failed with error: {exc}. Falling back to RRF ranking.")
            for c in candidates:
                c.setdefault("rerank_score", None)
            return candidates[:k]


# Singleton instance
reranker_service = CrossEncoderReranker()


def get_reranker() -> CrossEncoderReranker:
    return reranker_service
