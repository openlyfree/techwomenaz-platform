import { describe, expect, it, vi } from "vitest";
import { categorizeInterest } from "./jev";

describe("Jev interest categorization", () => {
  it("uses an honest local fallback when no key is configured", async () => {
    const result = await categorizeInterest("I want to learn AI and meet peers", {}, vi.fn());
    expect(result.source).toBe("manual");
    expect(result.categories).toContain("Learning AI");
    expect(result.notice).toContain("not configured");
  });

  it("sends only the answer and returns editable canonical suggestions", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ categories: ["Learning AI", "invalid"] }), { status: 200 }));
    const result = await categorizeInterest("I enjoy neural networks", { TYPESAFE_API_KEY: "private" }, fetcher);
    expect(result).toEqual({ categories: ["Learning AI"], source: "jev", notice: null });
    const body = JSON.parse(String(fetcher.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain("email");
    expect(JSON.stringify(body)).not.toContain("name");
  });

  it("redacts contact details embedded in free text before sending", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ categories: ["Networking"] }), { status: 200 }));
    await categorizeInterest("Call me at 415-555-1212 or person@example.com; https://social.example/me", { TYPESAFE_API_KEY: "private" }, fetcher);
    const body = String(fetcher.mock.calls[0][1].body);
    expect(body).not.toContain("person@example.com");
    expect(body).not.toContain("415-555-1212");
    expect(body).not.toContain("https://social.example/me");
  });

  it("falls back truthfully when Jev fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const result = await categorizeInterest("networking", { TYPESAFE_API_KEY: "private" }, fetcher);
    expect(result.source).toBe("manual");
    expect(result.notice).toContain("unavailable");
  });
});
