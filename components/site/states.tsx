"use client";

import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]";

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1140px] px-4 py-16 sm:px-6 sm:py-20">{children}</div>;
}

export function SiteLoading({ label = "Loading site content…" }: { label?: string }) {
  return (
    <div className="min-h-[50vh] bg-[#F8F3EE]" role="status" aria-live="polite">
      <Wrap>
        <div className="grid justify-items-center gap-4 text-center">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-[#E1D2C7] border-t-[#DE6219]" aria-hidden="true" />
          <p className="m-0 text-[0.95rem] text-[#6B5E56]">{label}</p>
        </div>
      </Wrap>
    </div>
  );
}

export function SiteErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-[40vh] bg-[#F8F3EE]" role="alert">
      <Wrap>
        <div className="mx-auto grid max-w-[640px] justify-items-center gap-4 rounded-[6px] border border-[#E1D2C7] bg-[#FFFBF8] px-6 py-10 text-center">
          <AlertCircle aria-hidden="true" className="h-8 w-8 text-[#DE6219]" />
          <p className="m-0 text-[1.1rem] font-semibold text-[#2E2620]">Site content could not be loaded</p>
          <p className="m-0 text-[0.95rem] leading-[1.6] text-[#6B5E56]">{message}</p>
          {onRetry ? (
            <button
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#B84E10] ${focusRing}`}
              onClick={onRetry}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" /> Try again
            </button>
          ) : null}
        </div>
      </Wrap>
    </div>
  );
}

export function SiteEmpty({
  message,
  href = "/",
  title = "Not available yet",
}: {
  message: string;
  href?: string;
  title?: string;
}) {
  return (
    <div className="min-h-[40vh] bg-[#F8F3EE]">
      <Wrap>
        <div className="mx-auto grid max-w-[640px] justify-items-center gap-4 rounded-[6px] border border-dashed border-[#E1D2C7] bg-[#FFFBF8] px-6 py-10 text-center">
          <h1
            className="m-0 font-normal leading-[1.15] text-[#C85512]"
            style={{ fontFamily: '"Fraunces", Georgia, "Times New Roman", serif', fontSize: "clamp(1.8rem, 6vw, 2.4rem)" }}
          >
            {title}
          </h1>
          <p className="m-0 text-[1.05rem] leading-[1.6] text-[#6B5E56]">{message}</p>
          <a
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C85512] hover:bg-[#DE6219] hover:text-white ${focusRing}`}
            href={href}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to home
          </a>
        </div>
      </Wrap>
    </div>
  );
}

/** Shown when the API explicitly marks its records as demo/synthetic. */
export function SiteDemoNotice() {
  return (
    <div className="bg-[#FFF4E8] px-4 py-3 text-center text-[0.85rem] leading-[1.5] text-[#6B4A31]" role="status" aria-live="polite">
      <p className="m-0">
        This site is currently showing demo content. Published information may differ.
      </p>
    </div>
  );
}

/** Shown when the live API is unavailable and sourced brand copy is displayed. */
export function SiteFallbackNotice({
  detail,
  onRetry,
}: {
  detail?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-[#FFF4E8] px-4 py-3 text-center text-[0.85rem] leading-[1.5] text-[#6B4A31]" role="status" aria-live="polite">
      <p className="mx-auto m-0 flex max-w-[900px] flex-wrap items-center justify-center gap-x-3 gap-y-2">
        <span>
          Live site content is unavailable right now. You are seeing our published brand information;
          event and team details may be out of date.
          {detail ? <span className="block text-[0.78rem] opacity-80">{detail}</span> : null}
        </span>
        {onRetry ? (
          <button
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#C85512] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C85512] hover:bg-[#DE6219] hover:text-white ${focusRing}`}
            onClick={onRetry}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Retry live content
          </button>
        ) : null}
      </p>
    </div>
  );
}
