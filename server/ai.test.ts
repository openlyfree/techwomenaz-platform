import { describe, it, expect } from "vitest";
import { suggestContent, suggestMailing } from "./ai";
import { defaultSiteDocument } from "./content-utils";
import type { SiteDocument } from "../lib/contracts";
import type { WorkersAiBinding } from "./env";

const current = (): SiteDocument => defaultSiteDocument(5);

type AiSpy = { count: number; model: string | null };

function aiReturning(payload: unknown, spy?: AiSpy): WorkersAiBinding {
  return {
    async run(model, _input) {
      if (spy) {
        spy.count += 1;
        spy.model = model;
      }
      const text = typeof payload === "string" ? payload : JSON.stringify(payload);
      return { response: text };
    },
  };
}

const fenced = (value: unknown) => `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;

describe("Workers AI missing binding is truthful", () => {
  it("suggestContent reports that AI is not configured and nothing changed", async () => {
    await expect(suggestContent(undefined, current(), "add a program", undefined)).rejects.toThrow(
      /not configured/i,
    );
    await expect(suggestContent(undefined, current(), "add a program", undefined)).rejects.toThrow(
      /no content was changed/i,
    );
  });

  it("suggestMailing reports that AI is not configured and the draft was not changed", async () => {
    const input = { subject: "Hello", body: "News", prompt: "make it friendly" };
    await expect(suggestMailing(undefined, input)).rejects.toThrow(/not configured/i);
    await expect(suggestMailing(undefined, input)).rejects.toThrow(/draft was not changed/i);
  });
});

describe("suggestContent never auto-saves or auto-publishes", () => {
  it("returns an unpublished suggestion with a bounded summary and fresh objects", async () => {
    const original = current();
    const snapshot = JSON.stringify(original);
    const doc = { ...original, theme: "navy" as const, sections: original.sections.map((s) => ({ ...s, title: "Suggested" })) };
    const ai = aiReturning(fenced({ document: doc, summary: "S".repeat(700) }));

    const result = await suggestContent(ai, original, "make it navy", undefined);

    expect(result.source).toBe("workers-ai");
    expect(Object.keys(result).sort()).toEqual(["document", "source", "summary"]);
    expect(result.document.version).toBe(6);
    expect(result.document.theme).toBe("navy");
    expect(result.summary).toHaveLength(500);
    expect(result.document).not.toBe(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("accepts chat-completion response shapes", async () => {
    const doc = current();
    const ai: WorkersAiBinding = {
      async run() {
        return { choices: [{ message: { content: JSON.stringify({ document: doc, summary: "ok" }) } }] };
      },
    };
    const result = await suggestContent(ai, doc, "p", "hero-main");
    expect(result.document.version).toBe(6);
    expect(result.summary).toBe("ok");
  });

  it("propagates AI transport errors without inventing success", async () => {
    const ai: WorkersAiBinding = { async run() { throw new Error("AI gateway unavailable"); } };
    await expect(suggestContent(ai, current(), "p", undefined)).rejects.toThrow(/AI gateway unavailable/);
  });
});

describe("suggestContent rejects malformed, code-like and unknown-field AI output", () => {
  it("rejects non-JSON output", async () => {
    await expect(suggestContent(aiReturning("Here is your document:"), current(), "p", undefined)).rejects.toThrow(/JSON/i);
  });

  it("rejects malformed JSON output", async () => {
    await expect(suggestContent(aiReturning("{not valid json}"), current(), "p", undefined)).rejects.toThrow(/malformed JSON/i);
  });

  it("rejects a missing document field with an actionable no-change message", async () => {
    await expect(suggestContent(aiReturning({ summary: "looks good" }), current(), "p", undefined)).rejects.toThrow(
      /no content was changed/i,
    );
  });

  it("rejects an unknown section field with an actionable no-change message", async () => {
    const doc = { ...current(), sections: [{ ...current().sections[0], published: true }] };
    await expect(suggestContent(aiReturning({ document: doc, summary: "ok" }), current(), "p", undefined)).rejects.toThrow(
      /no content was changed/i,
    );
  });

  it("rejects code-like document text with an actionable no-change message", async () => {
    const doc = { ...current(), sections: [{ ...current().sections[0], body: "<script>alert(1)</script>" }] };
    await expect(suggestContent(aiReturning({ document: doc, summary: "ok" }), current(), "p", undefined)).rejects.toThrow(
      /no content was changed/i,
    );
  });

  it("rejects unknown top-level AI fields", async () => {
    const payload = { document: current(), summary: "ok", published: true };
    await expect(suggestContent(aiReturning(payload), current(), "p", undefined)).rejects.toThrow(/unexpected field/i);
  });

  it("rejects null or array payloads without changing content", async () => {
    await expect(suggestContent(aiReturning("null"), current(), "p", undefined)).rejects.toThrow(/JSON/i);
    await expect(suggestContent(aiReturning("[1,2,3]"), current(), "p", undefined)).rejects.toThrow(/JSON/i);
  });
});

describe("suggestMailing bounds and safety", () => {
  it("returns a source-labeled suggestion and bounds subject and body", async () => {
    const ai = aiReturning({ subject: "S".repeat(260), body: "B".repeat(25_000) });
    const result = await suggestMailing(ai, { subject: "Hi", body: "News", prompt: "shorter" });
    expect(result.source).toBe("workers-ai");
    expect(result.subject).toHaveLength(200);
    expect(result.body).toHaveLength(20_000);
    expect(Object.keys(result).sort()).toEqual(["body", "source", "subject"]);
  });

  it("rejects missing or non-string subject/body", async () => {
    await expect(suggestMailing(aiReturning({ subject: "only subject" }), { subject: "s", body: "b", prompt: "p" })).rejects.toThrow(/subject or body/i);
    await expect(suggestMailing(aiReturning({ subject: 1, body: "b" }), { subject: "s", body: "b", prompt: "p" })).rejects.toThrow(/subject or body/i);
  });

  it("rejects code-like newsletter output", async () => {
    await expect(
      suggestMailing(aiReturning({ subject: "Hi", body: "javascript:alert(1)" }), { subject: "s", body: "b", prompt: "p" }),
    ).rejects.toThrow(/unsafe|code-like/i);
    await expect(
      suggestMailing(aiReturning({ subject: "<script>x</script>", body: "hello" }), { subject: "s", body: "b", prompt: "p" }),
    ).rejects.toThrow(/unsafe|code-like/i);
  });

  it("rejects unknown top-level newsletter fields", async () => {
    const payload = { subject: "Hi", body: "News", subscribeEveryone: true };
    await expect(suggestMailing(aiReturning(payload), { subject: "s", body: "b", prompt: "p" })).rejects.toThrow(/unexpected field/i);
  });

  it("rejects malformed newsletter JSON", async () => {
    await expect(suggestMailing(aiReturning("not json at all"), { subject: "s", body: "b", prompt: "p" })).rejects.toThrow(/JSON/i);
  });
});
