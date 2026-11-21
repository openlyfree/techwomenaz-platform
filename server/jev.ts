import { INTEREST_AREAS } from "../lib/contracts";
import type { PlatformBindings } from "./env";
import { manualCategorize } from "./content-utils";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const DEFAULT_JEV_URL = "https://api.typesafe.ai/v1/chat/completions";

function responsePayload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return responsePayload(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const message = (choices[0] as Record<string, unknown>).message;
    if (message && typeof message === "object") {
      return responsePayload((message as Record<string, unknown>).content);
    }
  }
  return record;
}

function withoutContactDetails(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/https?:\/\/[^\s]+/gi, "[redacted URL]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
      .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted phone]");
  }
  if (Array.isArray(value)) return value.map(withoutContactDetails);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, withoutContactDetails(item)]));
  }
  return value;
}

async function requestJev(
  payload: Record<string, unknown>,
  env: PlatformBindings,
  fetcher: FetchLike,
): Promise<Record<string, unknown>> {
  if (!env.TYPESAFE_API_KEY) throw new Error("Jev is not configured");
  const response = await fetcher(env.AI_GATEWAY_URL || DEFAULT_JEV_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.TYPESAFE_API_KEY}` },
    body: JSON.stringify(withoutContactDetails(payload)),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Jev unavailable (${response.status})`);
  return responsePayload(await response.json());
}

export async function categorizeInterest(
  answer: string,
  env: PlatformBindings,
  fetcher: FetchLike = fetch,
): Promise<{ categories: string[]; source: "jev" | "manual"; notice: string | null }> {
  if (!env.TYPESAFE_API_KEY) {
    return {
      categories: manualCategorize(answer),
      source: "manual",
      notice: "Jev is not configured; these editable suggestions use local keyword matching.",
    };
  }
  try {
    const result = await requestJev(
      { task: "categorize_interests", answer, allowedCategories: INTEREST_AREAS },
      env,
      fetcher,
    );
    const categories = Array.isArray(result.categories)
      ? result.categories.filter((item): item is string => typeof item === "string" && INTEREST_AREAS.includes(item))
      : [];
    return { categories: [...new Set(categories)].slice(0, 4), source: "jev", notice: null };
  } catch (error) {
    const reason = error instanceof Error && error.message.startsWith("Jev unavailable") ? error.message : "Jev unavailable";
    return {
      categories: manualCategorize(answer),
      source: "manual",
      notice: `${reason}; these editable suggestions use local keyword matching.`,
    };
  }
}

export interface JevRankItem {
  id: string;
  reasons: string[];
  confidence: number | null;
}

export async function rankWithJev(
  actor: Record<string, unknown>,
  candidates: Record<string, unknown>[],
  env: PlatformBindings,
  fetcher: FetchLike = fetch,
): Promise<JevRankItem[] | null> {
  if (!env.TYPESAFE_API_KEY) return null;
  try {
    const result = await requestJev({ task: "rank_professional_discovery", actor, candidates }, env, fetcher);
    if (!Array.isArray(result.ranking)) return null;
    const validIds = new Set(candidates.map((candidate) => String(candidate.id)));
    return result.ranking.flatMap((value): JevRankItem[] => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      if (typeof item.id !== "string" || !validIds.has(item.id)) return [];
      return [{
        id: item.id,
        reasons: Array.isArray(item.reasons) ? item.reasons.filter((reason): reason is string => typeof reason === "string").slice(0, 3) : [],
        confidence: typeof item.confidence === "number" && item.confidence >= 0 && item.confidence <= 1 ? item.confidence : null,
      }];
    });
  } catch {
    return null;
  }
}
