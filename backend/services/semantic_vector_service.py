import hashlib
import threading
from typing import Optional

import numpy as np

try:
    import faiss as _FAISS  # type: ignore
except Exception:  # pragma: no cover
    _FAISS = None

try:
    from sentence_transformers import SentenceTransformer as _SentenceTransformer
except Exception:  # pragma: no cover
    _SentenceTransformer = None


class SemanticVectorService:
    def __init__(self, model_name: str, cache_size: int = 20000):
        self.model_name = model_name
        self.cache_size = cache_size
        self._model = None
        self._lock = threading.Lock()
        self._doc_cache: dict[str, np.ndarray] = {}

    def available(self) -> bool:
        return _SentenceTransformer is not None

    def _get_model(self):
        if self._model is not None:
            return self._model
        if _SentenceTransformer is None:
            raise RuntimeError("sentence-transformers is not installed")
        with self._lock:
            if self._model is None:
                self._model = _SentenceTransformer(self.model_name)
        return self._model

    def _cache_key(self, text: str) -> str:
        return hashlib.sha1(text.encode("utf-8")).hexdigest()

    def _encode_query(self, query: str) -> np.ndarray:
        model = self._get_model()
        emb = model.encode([query], normalize_embeddings=True, convert_to_numpy=True)
        return emb.astype(np.float32)

    def _encode_documents(self, documents: list[str]) -> np.ndarray:
        model = self._get_model()
        vectors: list[np.ndarray] = []
        missing_docs: list[str] = []
        missing_keys: list[str] = []

        for doc in documents:
            key = self._cache_key(doc)
            cached = self._doc_cache.get(key)
            if cached is None:
                missing_docs.append(doc)
                missing_keys.append(key)
                vectors.append(np.array([], dtype=np.float32))
            else:
                vectors.append(cached)

        if missing_docs:
            encoded = model.encode(missing_docs, normalize_embeddings=True, convert_to_numpy=True).astype(np.float32)
            miss_idx = 0
            for i, v in enumerate(vectors):
                if v.size == 0:
                    emb = encoded[miss_idx]
                    vectors[i] = emb
                    self._doc_cache[missing_keys[miss_idx]] = emb
                    miss_idx += 1
            if len(self._doc_cache) > self.cache_size:
                # Keep cache bounded by evicting oldest inserted items.
                overflow = len(self._doc_cache) - self.cache_size
                for k in list(self._doc_cache.keys())[:overflow]:
                    self._doc_cache.pop(k, None)

        return np.vstack(vectors).astype(np.float32)

    def score(self, query: str, documents: list[str]) -> list[float]:
        if not query or not documents:
            return [0.0] * len(documents)

        query_emb = self._encode_query(query)
        doc_embs = self._encode_documents(documents)

        if _FAISS is not None:
            index = _FAISS.IndexFlatIP(doc_embs.shape[1])
            index.add(doc_embs)
            sim, idx = index.search(query_emb, len(documents))
            scores = [0.0] * len(documents)
            for rank_idx, doc_idx in enumerate(idx[0]):
                if doc_idx < 0:
                    continue
                scores[int(doc_idx)] = float(sim[0][rank_idx])
            return scores

        # Fallback to cosine similarity with normalized embeddings.
        sims = np.matmul(doc_embs, query_emb[0])
        return sims.astype(np.float32).tolist()


_service: Optional[SemanticVectorService] = None
_service_lock = threading.Lock()


def get_semantic_vector_service(model_name: str) -> SemanticVectorService:
    global _service
    if _service is not None and _service.model_name == model_name:
        return _service
    with _service_lock:
        if _service is None or _service.model_name != model_name:
            _service = SemanticVectorService(model_name=model_name)
    return _service


def semantic_vector_scores(query: str, documents: list[str], model_name: str) -> Optional[list[float]]:
    service = get_semantic_vector_service(model_name)
    if not service.available():
        return None
    try:
        return service.score(query, documents)
    except Exception:
        # Keep search endpoint available even if model download/runtime fails.
        return None
