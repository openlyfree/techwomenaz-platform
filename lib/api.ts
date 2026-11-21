"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionUser } from "./contracts";
import { errorMessage } from "./client-errors";

interface RpcEnvelope<T> {
  result?: { data: T };
  error?: { message?: string; json?: { message?: string } };
}

async function request<T>(procedure: string, input: unknown, mutation: boolean): Promise<T> {
  const encoded = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  const response = await fetch(`/api/trpc/${procedure}${mutation ? "" : encoded}`, {
    method: mutation ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: mutation ? { "Content-Type": "application/json" } : undefined,
    body: mutation ? JSON.stringify(input ?? {}) : undefined,
  });
  const raw: unknown = await response.json().catch(() => ({}));
  const payload = (raw && typeof raw === "object" ? raw : {}) as RpcEnvelope<T>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.json?.message ?? payload.error?.message ?? "This service is unavailable. Please try again shortly.");
  }
  if (!payload.result) throw new Error("We couldn't load that information. Please try again.");
  return payload.result.data;
}

export function query<T>(procedure: string, input?: unknown): Promise<T> {
  return request<T>(procedure, input, false);
}
export function mutate<T>(procedure: string, input?: unknown): Promise<T> {
  return request<T>(procedure, input, true);
}

export function useQuery<T>(procedure: string, input?: unknown) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify(input);
  const inputRef = useRef(input);
  inputRef.current = input;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    query<T>(procedure, inputRef.current)
      .then((value) => { if (active) setData(value); })
      .catch((reason: unknown) => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [procedure, key, revision]);
  return { data, loading, error, refresh };
}

export function useSession() {
  const { data, ...state } = useQuery<SessionUser | null>("auth.session");
  return { user: data ?? null, ...state };
}
