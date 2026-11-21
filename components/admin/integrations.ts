/**
 * Pure, framework-free helpers for the staff Integrations settings page.
 *
 * These descriptors describe configuration truthfully: a missing service is
 * reported as missing, never as a fake success, and there is no privileged
 * demo bypass. Demo mode is a mode flag, not a connected service.
 */

export type IntegrationKey =
  | "database"
  | "jev"
  | "workersAi"
  | "email"
  | "hubspot"
  | "turnstile"
  | "demo";

export type IntegrationTone = "critical" | "feature" | "optional" | "info";

export interface IntegrationStatus {
  database: boolean;
  jev: boolean;
  workersAi: boolean;
  email: boolean;
  hubspot: boolean;
  turnstile: boolean;
  demo: boolean;
}

export interface IntegrationDescriptor {
  key: IntegrationKey;
  label: string;
  descriptionWhenOn: string;
  descriptionWhenOff: string;
  /** Clear setup task shown only while the service is not configured. */
  task: string;
  tone: IntegrationTone;
}

export interface IntegrationSummary {
  configured: IntegrationDescriptor[];
  missing: IntegrationDescriptor[];
  demo: boolean;
}

export interface IntegrationCard {
  key: IntegrationKey;
  label: string;
  tone: IntegrationTone;
  connected: boolean;
  statusText: "Connected" | "Not configured";
  description: string;
  task: string | null;
}

/**
 * Ordered descriptors for every flag returned by `admin.integrations`.
 * Off-state copy states honestly what is unavailable; no service claims a
 * successful send, ranking, draft or handoff when it is not configured.
 */
export const INTEGRATIONS: readonly IntegrationDescriptor[] = [
  {
    key: "database",
    label: "Database (Postgres)",
    descriptionWhenOn:
      "Postgres is connected. Membership, applications and match records are persisted and reported from real data.",
    descriptionWhenOff:
      "No Postgres connection is configured. Records cannot be persisted and statistics cannot be shown.",
    task: "Configure DATABASE_URL and run the migrations.",
    tone: "critical",
  },
  {
    key: "jev",
    label: "Jev ranking",
    descriptionWhenOn:
      "Jev is connected. Discovery suggestions are ranked with goals, expertise and availability context.",
    descriptionWhenOff:
      "Jev is not configured. Discovery falls back to manual matching with no ranking suggestions.",
    task: "Configure the Jev API credentials.",
    tone: "feature",
  },
  {
    key: "workersAi",
    label: "Workers AI drafts",
    descriptionWhenOn:
      "Workers AI is connected. Staff can generate draft suggestions, which are always reviewed before publishing.",
    descriptionWhenOff:
      "Workers AI is not configured. AI draft suggestions are unavailable; staff can still write content manually.",
    task: "Configure the Workers AI binding.",
    tone: "feature",
  },
  {
    key: "email",
    label: "Email transport",
    descriptionWhenOn:
      "Email transport is connected. Sign-in links and notifications can be delivered to verified addresses.",
    descriptionWhenOff:
      "No email transport is configured. Sign-in links and notifications cannot be sent, so applications remain pending.",
    task: "Configure an email transport and verified sender.",
    tone: "critical",
  },
  {
    key: "hubspot",
    label: "HubSpot handoff",
    descriptionWhenOn:
      "HubSpot handoff is configured. Staff can export consented contacts for import, with HubSpot suppressions still enforced.",
    descriptionWhenOff:
      "HubSpot is not configured. Use the CSV export handoff for staff import; no contacts are sent automatically.",
    task: "Configure the HubSpot credentials for the export handoff.",
    tone: "optional",
  },
  {
    key: "turnstile",
    label: "Turnstile",
    descriptionWhenOn:
      "Turnstile is configured. Public forms are bot-verified before submission.",
    descriptionWhenOff:
      "Turnstile is not configured. Public forms are not bot-verified.",
    task: "Configure the Turnstile site and secret keys.",
    tone: "optional",
  },
  {
    key: "demo",
    label: "Demo mode",
    descriptionWhenOn:
      "Demo mode is on. Synthetic sample data may be shown and actions do not operate on production records.",
    descriptionWhenOff:
      "Demo mode is off. The site uses live data only.",
    task: "Turn off demo mode before launch with real members.",
    tone: "info",
  },
];

/** Demo mode is a mode flag, not a service, so it is summarized separately. */
const SERVICE_KEYS: readonly IntegrationKey[] = INTEGRATIONS.filter(
  (descriptor) => descriptor.key !== "demo",
).map((descriptor) => descriptor.key);

/** Split the status flags into configured and missing services plus demo mode. */
export function summarizeIntegrations(status: IntegrationStatus): IntegrationSummary {
  const configured: IntegrationDescriptor[] = [];
  const missing: IntegrationDescriptor[] = [];

  for (const descriptor of INTEGRATIONS) {
    if (!SERVICE_KEYS.includes(descriptor.key)) continue;
    (status[descriptor.key] ? configured : missing).push(descriptor);
  }

  return { configured, missing, demo: status.demo };
}

/** Ready-to-render cards with honest copy and a task label only when missing. */
export function integrationCards(status: IntegrationStatus): IntegrationCard[] {
  return INTEGRATIONS.map((descriptor) => {
    const connected = status[descriptor.key];
    const isDemo = descriptor.key === "demo";
    return {
      key: descriptor.key,
      label: descriptor.label,
      tone: descriptor.tone,
      connected,
      statusText: connected ? "Connected" : "Not configured",
      description: connected ? descriptor.descriptionWhenOn : descriptor.descriptionWhenOff,
      task: connected || isDemo ? null : descriptor.task,
    };
  });
}
