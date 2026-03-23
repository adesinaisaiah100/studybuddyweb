import type { RetrievalBundle } from "@/lib/ai/study-buddy/types";

type CacheEntry = {
  expiresAt: number;
  payload: RetrievalBundle;
};

const retrievalCache = new Map<string, CacheEntry>();
const RETRIEVAL_TTL_MS = 60_000;

export function readRetrievalCache(key: string): RetrievalBundle | null {
  const entry = retrievalCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    retrievalCache.delete(key);
    return null;
  }

  return entry.payload;
}

export function writeRetrievalCache(key: string, payload: RetrievalBundle) {
  retrievalCache.set(key, {
    expiresAt: Date.now() + RETRIEVAL_TTL_MS,
    payload,
  });
}
