"use client";

import { useMemo } from "react";
import { useQuery } from "@/lib/api";
import type { PublicSite } from "@/lib/contracts";
import { getDefaultSiteContent } from "./content";

export interface PublicSiteState {
  data: PublicSite;
  loading: boolean;
  error: string | null;
  /** True only when sourced brand copy is shown because live content is missing. */
  usingFallback: boolean;
  refresh: () => void;
}

function describeError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "The live site service did not respond. Please try again shortly.";
}

/**
 * Pure state resolution, kept separate from the hook so it can be tested with SSR.
 * When live content is missing or the API errors, the fallback notice claims the
 * visitor is seeing sourced brand copy — so the data actually rendered must be that
 * brand copy, never stale records left over from an earlier successful request.
 */
export function resolvePublicSiteState(
  raw: PublicSite | undefined,
  loading: boolean,
  error: string | null,
  defaults: PublicSite,
): Pick<PublicSiteState, "data" | "error" | "usingFallback"> {
  const usingFallback = !loading && (!raw || Boolean(error));
  return {
    data: usingFallback ? defaults : (raw ?? defaults),
    error,
    usingFallback,
  };
}

/** Loads the published site document and records from the `public.site` procedure. */
export function usePublicSite(): PublicSiteState {
  const { data, loading, error, refresh } = useQuery<PublicSite>("public.site");
  const defaults = useMemo(() => getDefaultSiteContent(), []);
  const message = describeError(error);
  const resolved = resolvePublicSiteState(data, loading, message, defaults);
  return {
    ...resolved,
    loading,
    refresh,
  };
}
