import numpy as np

from services.semantic_vector_service import SemanticVectorService


class StubModel:
    def encode(self, texts, normalize_embeddings=True, convert_to_numpy=True):
        vectors = []
        for text in texts:
            lowered = text.lower()
            if "rag" in lowered or "bm25" in lowered:
                vectors.append([1.0, 0.0, 0.0])
            elif "python" in lowered:
                vectors.append([0.0, 1.0, 0.0])
            else:
                vectors.append([0.0, 0.0, 1.0])
        arr = np.array(vectors, dtype=np.float32)
        if normalize_embeddings:
            norms = np.linalg.norm(arr, axis=1, keepdims=True)
            norms[norms == 0] = 1
            arr = arr / norms
        return arr


def test_semantic_vector_scores_prefers_relevant_doc():
    service = SemanticVectorService(model_name="stub-model")
    service._model = StubModel()

    scores = service.score(
        query="RAG 检索",
        documents=[
            "熟悉 Python 后端开发",
            "有 RAG 系统与 BM25 混合检索经验",
            "前端开发",
        ],
    )

    assert len(scores) == 3
    assert scores[1] > scores[0]
    assert scores[1] > scores[2]
