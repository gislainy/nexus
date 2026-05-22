import { describe, it, expect } from "vitest";
import { SparseRetrievalService } from "../../src/services/retrieval/sparse.js";

describe("SparseRetrievalService (unit)", () => {
  const rows = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      text: "Blockchain enables tamper-evident audit trails for health records.",
      tags: ["TECHNICAL_JUSTIFICATION"],
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      text: "Pasta carbonara recipe with eggs, cheese, and pancetta.",
      tags: ["COOKING"],
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      text: "Distributed ledger technology in healthcare faces privacy challenges.",
      tags: ["REGULATORY_COMPLIANCE"],
    },
  ];

  it("returns the most relevant document for a query", () => {
    const svc = new SparseRetrievalService({} as never);
    svc.indexFromRows(rows);
    const hits = svc.retrieve("blockchain health records audit", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.chunkId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("filters by tag when provided", () => {
    const svc = new SparseRetrievalService({} as never);
    svc.indexFromRows(rows);
    const hits = svc.retrieve("blockchain health", 3, "REGULATORY_COMPLIANCE");
    for (const h of hits) {
      expect(h.chunkId).toBe("33333333-3333-3333-3333-333333333333");
    }
  });
});
