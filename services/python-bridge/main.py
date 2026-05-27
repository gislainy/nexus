import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

from reranker import Reranker

logger = logging.getLogger("python-bridge")

reranker: Reranker | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global reranker
    logger.info("Loading bge-reranker-v2-m3...")
    reranker = Reranker()
    logger.info("Reranker ready")
    yield
    reranker = None


app = FastAPI(title="Nexus Python Bridge", lifespan=lifespan)


class Candidate(BaseModel):
    chunkId: str
    text: str


class RerankRequest(BaseModel):
    query: str
    candidates: List[Candidate]
    topK: int = 5


class RerankResult(BaseModel):
    chunkId: str
    score: float


class RerankResponse(BaseModel):
    reranked: List[RerankResult]


@app.post("/rerank", response_model=RerankResponse)
def rerank_endpoint(request: RerankRequest) -> RerankResponse:
    if not request.candidates:
        return RerankResponse(reranked=[])
    texts = [c.text for c in request.candidates]
    scores = reranker.rerank(request.query, texts)  # type: ignore[union-attr]
    scored = sorted(
        zip([c.chunkId for c in request.candidates], scores),
        key=lambda x: x[1],
        reverse=True,
    )
    return RerankResponse(
        reranked=[
            RerankResult(chunkId=cid, score=round(float(s), 6))
            for cid, s in scored[: request.topK]
        ]
    )


@app.get("/health")
def health():
    return {"status": "ok", "model": "bge-reranker-v2-m3"}
