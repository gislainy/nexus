from typing import List

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_ID = "BAAI/bge-reranker-v2-m3"


class Reranker:
    def __init__(self) -> None:
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
        self.model.eval()
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)

    def rerank(self, query: str, texts: List[str]) -> List[float]:
        """Returns a relevance score for each (query, text) pair. Higher = more relevant."""
        if not texts:
            return []
        pairs = [[query, text] for text in texts]
        encoded = self.tokenizer(
            pairs,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        ).to(self.device)
        with torch.no_grad():
            logits = self.model(**encoded).logits
        scores = torch.sigmoid(logits).squeeze(-1).tolist()
        if isinstance(scores, float):
            scores = [scores]
        return scores
