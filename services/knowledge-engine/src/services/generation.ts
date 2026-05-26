export interface GenerationPassage {
  chunkId: string;
  text: string;
  claim?: string;
  source: {
    authors: string[];
    year: number;
    title: string;
    venue: string;
    pageRef?: string;
  };
}

export interface GenerationRequest {
  queryText: string;
  passages: GenerationPassage[];
  maxTokens?: number;
}

export interface CitedSpan {
  claim: string;
  chunkId: string;
  quote: string;
}

export interface GenerationResponse {
  answer: string;
  citedSpans: CitedSpan[];
  model: string;
  latencyMs: number;
  hasGrounding: boolean;
}

export interface OllamaGenerationOptions {
  baseUrl: string;
  model: string;
  maxTokens: number;
  fetchImpl?: typeof fetch;
}

export interface GenerationService {
  generate(request: GenerationRequest): Promise<GenerationResponse>;
  readonly modelName: string;
}

const SYSTEM_PROMPT = `You are a scientific assistant specializing in blockchain adoption for digital health systems.
Your task is to answer the user's query based EXCLUSIVELY on the provided passages.
Do not use any knowledge beyond what appears in the passages below.

INSTRUCTIONS:
1. Read all passages carefully.
2. Identify which passages are relevant to the query.
3. For each claim you make in your answer, you MUST cite the specific passage chunk ID and quote the exact supporting text span (≤ 40 words).
4. If no passage supports a potential claim, do NOT make that claim.
5. If no passage is relevant at all, state clearly: "The available evidence does not address this question."

OUTPUT FORMAT — respond with valid JSON only, no markdown fences:
{
  "answer": "<prose answer in the same language as the query>",
  "cited_spans": [
    {
      "claim": "<the specific claim this span supports>",
      "chunk_id": "<chunkId from context>",
      "quote": "<verbatim text span of ≤ 40 words from the passage>"
    }
  ]
}`;

function buildUserPrompt(req: GenerationRequest): string {
  const lines: string[] = [];
  lines.push(`QUERY: ${req.queryText}`);
  lines.push("");
  lines.push("PASSAGES:");
  for (const p of req.passages) {
    const author = p.source.authors.length > 0 ? p.source.authors[0] : "Unknown";
    const page = p.source.pageRef ? ` p. ${p.source.pageRef}` : "";
    lines.push(`[CHUNK ${p.chunkId}]`);
    lines.push(
      `Source: ${author} et al. (${p.source.year}). ${p.source.title}. ${p.source.venue}.${page}`,
    );
    lines.push(`Text: ${p.text}`);
    lines.push("");
  }
  lines.push("Now answer the query following the instructions above.");
  return lines.join("\n");
}

export class OllamaGenerationService implements GenerationService {
  readonly modelName: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OllamaGenerationOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.modelName = opts.model;
    this.maxTokens = opts.maxTokens;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const t0 = Date.now();
    const userPrompt = buildUserPrompt(request);
    const numPredict = request.maxTokens ?? this.maxTokens;

    const url = `${this.baseUrl}/api/chat`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          stream: false,
          options: { num_predict: numPredict },
        }),
      });
    } catch (err) {
      throw new Error(
        `Ollama generation unavailable: ${(err as Error).message}`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama returned ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "";

    let answer = content;
    let citedSpans: CitedSpan[] = [];
    try {
      const parsed = JSON.parse(content) as {
        answer?: unknown;
        cited_spans?: unknown;
      };
      if (typeof parsed.answer === "string" && Array.isArray(parsed.cited_spans)) {
        answer = parsed.answer;
        citedSpans = parsed.cited_spans
          .filter(
            (s): s is { claim: string; chunk_id: string; quote: string } =>
              typeof s === "object" &&
              s !== null &&
              typeof (s as { claim?: unknown }).claim === "string" &&
              typeof (s as { chunk_id?: unknown }).chunk_id === "string" &&
              typeof (s as { quote?: unknown }).quote === "string",
          )
          .map((s) => ({ claim: s.claim, chunkId: s.chunk_id, quote: s.quote }));
      }
    } catch {
      // Model did not return JSON; fall back to raw text with no grounding.
    }

    const latencyMs = Date.now() - t0;
    return {
      answer,
      citedSpans,
      model: this.modelName,
      latencyMs,
      hasGrounding: citedSpans.length > 0,
    };
  }
}
