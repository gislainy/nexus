import { describe, expect, it } from "vitest";
import {
  Artifact,
  ArtifactExtraction,
  GitConnection,
  RetrievalRequest,
  RetrievalResponse,
  RetrievedPassage,
} from "../src/knowledge.js";

const UUID = "00000000-0000-0000-0000-000000000030";
const UUID2 = "00000000-0000-0000-0000-000000000031";

describe("GitConnection / Artifact / ArtifactExtraction", () => {
  it("accepts a valid git connection", () => {
    const ok = GitConnection.safeParse({
      id: UUID,
      projectId: UUID2,
      gitRepoUrl: "https://github.com/example/repo.git",
      branch: "main",
      commitSha: "abcdef",
      status: "CONNECTED",
      connectedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects an invalid git URL", () => {
    const bad = GitConnection.safeParse({
      id: UUID,
      projectId: UUID2,
      gitRepoUrl: "not-a-url",
      branch: "main",
      commitSha: "abc",
      status: "CONNECTED",
      connectedAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid artifact", () => {
    const ok = Artifact.safeParse({
      id: UUID,
      projectId: UUID2,
      type: "CODE",
      origin: "UPLOAD",
      filename: "f.ts",
      storageKey: "k",
      storageBucket: "b",
      storageSizeBytes: 10,
      mimeType: "text/plain",
      analysisStatus: "PENDING",
      createdAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it("rejects artifact with bad type", () => {
    const bad = Artifact.safeParse({
      id: UUID,
      projectId: UUID2,
      type: "ZIP",
      origin: "UPLOAD",
      filename: "f.ts",
      storageKey: "k",
      storageBucket: "b",
      storageSizeBytes: 10,
      mimeType: "text/plain",
      analysisStatus: "PENDING",
      createdAt: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid extraction", () => {
    const ok = ArtifactExtraction.safeParse({
      id: UUID,
      artifactId: UUID2,
      questionTemplateId: "Q_X",
      extractedValue: "v",
      confidence: 0.7,
      evidenceSnippet: "s",
      extractedAt: new Date(),
    });
    expect(ok.success).toBe(true);
  });
});

describe("Retrieval contract", () => {
  it("accepts a valid request and response", () => {
    expect(
      RetrievalRequest.safeParse({ queryText: "q", topK: 5, tag: "tech" }).success,
    ).toBe(true);
    const passage = RetrievedPassage.safeParse({
      chunkId: UUID,
      text: "t",
      score: 0.9,
      layer: "core",
      source: {
        authors: ["A"],
        year: 2020,
        title: "T",
        venue: "V",
      },
    });
    expect(passage.success).toBe(true);
    expect(
      RetrievalResponse.safeParse({
        hasEvidence: true,
        passages: [
          {
            chunkId: UUID,
            text: "t",
            score: 0.9,
            layer: "core",
            source: { authors: ["A"], year: 2020, title: "T", venue: "V" },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects a passage with bad layer", () => {
    const bad = RetrievedPassage.safeParse({
      chunkId: UUID,
      text: "t",
      score: 0.9,
      layer: "deep",
      source: { authors: [], year: 2020, title: "T", venue: "V" },
    });
    expect(bad.success).toBe(false);
  });
});
