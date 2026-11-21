import { describe, expect, it } from "vitest";
import type { IntegrationStatus } from "./integrations";
import {
  INTEGRATIONS,
  integrationCards,
  summarizeIntegrations,
} from "./integrations";

const allOn: IntegrationStatus = {
  database: true,
  jev: true,
  workersAi: true,
  email: true,
  hubspot: true,
  turnstile: true,
  demo: true,
};

const allOff: IntegrationStatus = {
  database: false,
  jev: false,
  workersAi: false,
  email: false,
  hubspot: false,
  turnstile: false,
  demo: false,
};

describe("INTEGRATIONS descriptors", () => {
  it("covers every status key exactly once with the required fields", () => {
    const keys = INTEGRATIONS.map((descriptor) => descriptor.key);
    expect(keys).toEqual([
      "database",
      "jev",
      "workersAi",
      "email",
      "hubspot",
      "turnstile",
      "demo",
    ]);
    expect(new Set(keys).size).toBe(keys.length);

    for (const descriptor of INTEGRATIONS) {
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.descriptionWhenOn.length).toBeGreaterThan(0);
      expect(descriptor.descriptionWhenOff.length).toBeGreaterThan(0);
      expect(descriptor.tone).toBeTruthy();
    }
  });

  it("never claims a fake success or a privileged bypass in off-state text", () => {
    const offText = INTEGRATIONS.map((descriptor) => descriptor.descriptionWhenOff).join(" ");
    expect(offText).not.toMatch(/bypass|admin override|skip verification|auto-?approve/i);
    const workersAi = INTEGRATIONS.find((descriptor) => descriptor.key === "workersAi");
    const email = INTEGRATIONS.find((descriptor) => descriptor.key === "email");
    const hubspot = INTEGRATIONS.find((descriptor) => descriptor.key === "hubspot");
    expect(workersAi?.descriptionWhenOff).toMatch(/unavailable|not configured/i);
    expect(email?.descriptionWhenOff).toMatch(/cannot be sent|not configured/i);
    expect(hubspot?.descriptionWhenOff).toMatch(/not configured|export/i);
  });
});

describe("summarizeIntegrations", () => {
  it("separates configured services from missing ones and excludes demo mode", () => {
    const mixed = { ...allOn, workersAi: false, email: false, demo: true };
    const summary = summarizeIntegrations(mixed);

    expect(summary.configured.map((item) => item.key)).toEqual([
      "database",
      "jev",
      "hubspot",
      "turnstile",
    ]);
    expect(summary.missing.map((item) => item.key)).toEqual(["workersAi", "email"]);
    expect(summary.demo).toBe(true);
  });

  it("reports all services missing and demo off", () => {
    const summary = summarizeIntegrations(allOff);
    expect(summary.configured).toHaveLength(0);
    expect(summary.missing).toHaveLength(6);
    expect(summary.demo).toBe(false);
  });

  it("treats demo mode as a mode flag, not a connected service", () => {
    const onlyDemo = { ...allOff, demo: true };
    const summary = summarizeIntegrations(onlyDemo);
    expect(summary.configured.map((item) => item.key)).not.toContain("demo");
    expect(summary.missing.map((item) => item.key)).not.toContain("demo");
    expect(summary.configured).toHaveLength(0);
    expect(summary.missing).toHaveLength(6);
    expect(summary.demo).toBe(true);
  });
});

describe("integrationCards", () => {
  it("selects honest connected/not-configured copy and a task label only when missing", () => {
    const cards = integrationCards(allOff);
    const database = cards.find((card) => card.key === "database");

    expect(database?.connected).toBe(false);
    expect(database?.statusText).toBe("Not configured");
    expect(database?.description).toMatch(/cannot be persisted|not configured/i);
    expect(database?.task).toBeTruthy();

    const demoCard = cards.find((card) => card.key === "demo");
    expect(demoCard?.connected).toBe(false);
    expect(demoCard?.task).toBeNull();
  });

  it("shows Connected with no action task when a service is configured", () => {
    const card = integrationCards(allOn).find((card) => card.key === "jev");
    expect(card?.connected).toBe(true);
    expect(card?.statusText).toBe("Connected");
    expect(card?.description).toMatch(/connected/i);
    expect(card?.task).toBeNull();
  });
});
