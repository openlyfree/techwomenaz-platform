import { describe, expect, it } from "vitest";
import { buildSeedPlan } from "../scripts/seed.mjs";

describe("seed content dignity", () => {
  const plan = buildSeedPlan();
  const published = plan.content[0].published as { version: number; sections: Array<{ title: string; body: string; enabled: boolean }> };

  it("publishes real-feeling public copy without synthetic markers", () => {
    const published = plan.content[0].published;
    for (const section of published.sections) {
      expect(section.title, section.id).not.toMatch(/\[?synthetic/i);
      expect(section.body, section.id).not.toMatch(/\[?synthetic/i);
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.body.length).toBeGreaterThan(20);
    }
  });

  it("keeps every visible record honestly labeled as fictional", () => {
    for (const member of plan.members) {
      expect(member.name, member.id).toMatch(/^\[(synthetic|fictional)\]/);
      expect(member.email.endsWith(".invalid")).toBe(true);
    }
    for (const person of plan.team) expect(person.name).toMatch(/^\[(synthetic|fictional)\]/);
    for (const partner of plan.partners) expect(partner.name).toMatch(/^\[(synthetic|fictional)\]/);
  });

  it("includes the canonical interest areas from the brief", () => {
    const interests = new Set(plan.members.flatMap((member) => member.interests));
    expect(interests.has("Finding a mentor")).toBe(true);
    expect(interests.has("Learning AI")).toBe(true);
    expect(interests.has("Networking")).toBe(true);
  });
});
