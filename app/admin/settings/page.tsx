"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  FlaskConical,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery, useSession } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeading,
} from "@/components/ui";
import {
  integrationCards,
  summarizeIntegrations,
  type IntegrationKey,
  type IntegrationStatus,
} from "@/components/admin/integrations";

const ICONS: Record<IntegrationKey, LucideIcon> = {
  database: Database,
  jev: Sparkles,
  workersAi: Bot,
  email: Mail,
  hubspot: Building2,
  turnstile: ShieldCheck,
  demo: FlaskConical,
};

/** Show only short application-style messages; never dump unknown object data. */
function safeMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.length > 0 && error.length < 300) return error;
  if (error instanceof Error && error.message.length > 0 && error.message.length < 300) {
    return error.message;
  }
  return fallback;
}

export default function AdminSettingsPage() {
  const session = useSession();
  const integrations = useQuery<IntegrationStatus>("admin.integrations");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setRefreshing(false);
  }, [integrations.data, integrations.error]);

  const signInGate = (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7e7df] text-[#c2572a]">
            <Lock aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[#1f2a44]">Staff sign-in required</h2>
            <p className="text-sm leading-6 text-[#5b6172]">
              Integration status is available to authorized staff only.
            </p>
          </div>
        </div>
        <div>
          <Link
            className="inline-flex min-h-[44px] items-center rounded-full bg-[#c2572a] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2572a]"
            href="/login"
          >
            Sign in to continue <ArrowRight aria-hidden="true" className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
      </div>
    </Card>
  );

  return (
    <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <PageHeading
          title="Settings and integrations"
          description="A truthful view of which services are configured for this site. Nothing here sends data or grants access on its own."
        />

        {session.loading ? (
          <Loading label="Checking your session…" />
        ) : session.error ? (
          <ErrorNotice
            message={safeMessage(
              session.error,
              "We could not verify your session. Please refresh the page or sign in again.",
            )}
            onRetry={() => void session.refresh()}
          />
        ) : !session.user ? (
          signInGate
        ) : integrations.loading && !integrations.data ? (
          <Loading label="Loading integration status…" />
        ) : integrations.error && !integrations.data ? (
          <ErrorNotice
            message={safeMessage(
              integrations.error,
              "We could not load integration status. Check the server configuration and try again.",
            )}
          />
        ) : !integrations.data ? (
          <EmptyState
            title="No integration information available"
            description="The server did not return any integration status. Confirm the admin service is configured, then refresh."
          />
        ) : (
          <IntegrationsView
            status={integrations.data}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void integrations.refresh();
            }}
          />
        )}
      </div>
    </main>
  );
}

function IntegrationsView({
  status,
  refreshing,
  onRefresh,
}: {
  status: IntegrationStatus;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const summary = summarizeIntegrations(status);
  const cards = integrationCards(status);
  const total = summary.configured.length + summary.missing.length;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c2572a]">
              Configuration overview
            </p>
            <p className="text-sm leading-6 text-[#5b6172]">
              <span className="font-semibold text-[#1f2a44]">
                {summary.configured.length} of {total}
              </span>{" "}
              services connected. The remaining {summary.missing.length} need setup before those
              features work.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {summary.demo ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f7e7df] px-3 py-1 text-xs font-semibold text-[#a8421c]">
                  <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
                  Demo mode — sample data only
                </span>
              ) : (
                <Badge>Live data mode</Badge>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <Button onClick={onRefresh} disabled={refreshing}>
              <RefreshCw
                aria-hidden="true"
                className={`mr-1 inline h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing…" : "Refresh status"}
            </Button>
          </div>
        </div>
      </Card>

      {integrationsReminder(summary.missing.length)}

      <section aria-label="Integration status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = ICONS[card.key];
          return (
            <Card key={card.key}>
              <article className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      card.connected
                        ? "bg-[#e4f1e9] text-[#2f6b46]"
                        : "bg-[#f7e7df] text-[#c2572a]"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      card.connected
                        ? "bg-[#e4f1e9] text-[#2f6b46]"
                        : "bg-[#f1ece3] text-[#6b6472]"
                    }`}
                  >
                    {card.connected ? (
                      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    {card.statusText}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold text-[#1f2a44]">{card.label}</h2>
                  <p className="text-sm leading-6 text-[#5b6172]">{card.description}</p>
                </div>

                {card.task ? (
                  <p className="mt-auto border-t border-[#e9dfd3] pt-3 text-xs leading-5 text-[#6b6472]">
                    <span className="font-semibold uppercase tracking-wide text-[#c2572a]">
                      To connect:{" "}
                    </span>
                    {card.task}
                  </p>
                ) : (
                  <p className="mt-auto border-t border-[#e9dfd3] pt-3 text-xs leading-5 text-[#8a8490]">
                    No setup action needed right now.
                  </p>
                )}
              </article>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function integrationsReminder(missing: number) {
  if (missing === 0) return null;
  return (
    <p className="rounded-xl border border-[#ead9cd] bg-[#f7e7df]/60 px-4 py-3 text-sm leading-6 text-[#6d4f43]">
      A “Not configured” status means that feature is unavailable — no emails, AI drafts, ranking
      suggestions or CRM handoffs are simulated by this page.
    </p>
  );
}
