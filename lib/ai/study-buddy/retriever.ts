import { readRetrievalCache, writeRetrievalCache } from "@/lib/ai/study-buddy/cache";
import type {
  RetrievedContextItem,
  RetrievalBundle,
  StudyBuddyChatMessage,
  SupabaseServerClient,
} from "@/lib/ai/study-buddy/types";

type EmbeddingRow = {
  id: string;
  material_id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown> | null;
};

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedText(input: string): Promise<number[] | null> {
  if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_EMBEDDING_MODEL) {
    return null;
  }

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "LMS StudyBuddy",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_EMBEDDING_MODEL,
      input: [input],
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json();
  const vector = payload?.data?.[0]?.embedding;
  return Array.isArray(vector) ? (vector as number[]) : null;
}

function materialTitleFromMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return undefined;
  const rawTitle = metadata.title;
  return typeof rawTitle === "string" && rawTitle.trim().length > 0 ? rawTitle.trim() : undefined;
}

function rankKeywordMatches(rows: EmbeddingRow[], query: string, limit: number) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [] as RetrievedContextItem[];

  const ranked = rows
    .map((row) => {
      const hay = `${row.content} ${materialTitleFromMetadata(row.metadata) || ""}`.toLowerCase();
      const tokenHits = tokens.filter((token) => hay.includes(token)).length;
      return {
        row,
        score: tokenHits / tokens.length,
      };
    })
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map(({ row, score }) => ({
      id: row.id,
      content: row.content,
      materialTitle: materialTitleFromMetadata(row.metadata),
      materialId: row.material_id,
      score,
      retrievalMode: "keyword" as const,
    }));

  return ranked;
}

function mergeAndDedupe(...lists: RetrievedContextItem[][]) {
  const map = new Map<string, RetrievedContextItem>();

  for (const list of lists) {
    for (const item of list) {
      const key = item.id;
      const existing = map.get(key);
      if (!existing || item.score > existing.score) {
        map.set(key, item);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

function rankConversationHits(history: StudyBuddyChatMessage[], query: string, limit: number) {
  const tokens = tokenize(query);
  if (tokens.length === 0 || history.length === 0) return [] as RetrievedContextItem[];

  const combined = history
    .slice(-20)
    .map((message, index) => ({
      id: `conversation-${index}`,
      content: `${message.role}: ${message.content}`,
      materialId: undefined,
      materialTitle: "Previous Conversation",
      metadata: null,
    }));

  return combined
    .map((item) => {
      const hay = item.content.toLowerCase();
      const tokenHits = tokens.filter((token) => hay.includes(token)).length;
      return {
        id: item.id,
        content: item.content,
        materialId: item.materialId,
        materialTitle: item.materialTitle,
        score: tokenHits / tokens.length,
        retrievalMode: "conversation-keyword" as const,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function retrieveStudyContext(input: {
  supabase: SupabaseServerClient;
  courseId: string;
  query: string;
  conversationHistory: StudyBuddyChatMessage[];
}): Promise<RetrievalBundle> {
  const cacheKey = `${input.courseId}::${input.query.toLowerCase().trim()}`;
  const cached = readRetrievalCache(cacheKey);
  if (cached) {
    return { ...cached, usedCache: true };
  }

  const { data: embeddingsRows, error } = await input.supabase
    .from("course_embeddings")
    .select("id, material_id, content, embedding, metadata")
    .eq("course_id", input.courseId)
    .limit(250);

  if (error) {
    throw new Error(error.message || "Failed to retrieve study context.");
  }

  const rows = (embeddingsRows || []) as EmbeddingRow[];
  const keywordHits = rankKeywordMatches(rows, input.query, 12);

  let vectorHits: RetrievedContextItem[] = [];
  const queryEmbedding = await embedText(input.query);
  if (queryEmbedding) {
    vectorHits = rows
      .filter((row) => Array.isArray(row.embedding) && row.embedding.length > 0)
      .map((row) => ({
        row,
        score: cosineSimilarity(queryEmbedding, row.embedding),
      }))
      .filter((item) => item.score > 0)
      .sort((first, second) => second.score - first.score)
      .slice(0, 12)
      .map(({ row, score }) => ({
        id: row.id,
        content: row.content,
        materialTitle: materialTitleFromMetadata(row.metadata),
        materialId: row.material_id,
        score,
        retrievalMode: "vector" as const,
      }));
  }

  const materialHits = mergeAndDedupe(vectorHits, keywordHits).slice(0, 16);
  const conversationHits = rankConversationHits(input.conversationHistory, input.query, 8);

  const bundle: RetrievalBundle = {
    materialHits,
    conversationHits,
    usedCache: false,
  };

  writeRetrievalCache(cacheKey, bundle);
  return bundle;
}
