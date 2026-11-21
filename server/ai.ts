import type { SiteDocument } from "../lib/contracts";
import type { WorkersAiBinding } from "./env";
import { hasUnsafeText, parseSiteDocument } from "./content-utils";

/** Fail closed on model outputs that add fields we never persist or render. */
function rejectUnknownFields(value: Record<string, unknown>, allowed: readonly string[], noChangeNotice: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`Workers AI returned an unexpected field (${unknown.join(", ")}). ${noChangeNotice}`);
  }
}

function aiText(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;
  if (Array.isArray(record.choices) && record.choices[0] && typeof record.choices[0] === "object") {
    const message = (record.choices[0] as Record<string, unknown>).message;
    if (message && typeof message === "object" && typeof (message as Record<string, unknown>).content === "string") {
      return (message as Record<string, unknown>).content as string;
    }
  }
  return "";
}

function jsonObject(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Workers AI returned no JSON document. Edit the existing draft manually.");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("Workers AI returned malformed JSON. No content was saved; please retry or edit manually.");
  }
}

export async function suggestContent(
  ai: WorkersAiBinding | undefined,
  current: SiteDocument,
  prompt: string,
  sectionId: string | undefined,
): Promise<{ document: SiteDocument; summary: string; source: "workers-ai" }> {
  if (!ai) throw new Error("Workers AI is not configured. Bind env.AI to generate suggestions; no content was changed.");
  const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: "Return only JSON with document and summary. document must be a complete SiteDocument with version, theme desert|navy, and sections containing only id,type,title,body,enabled. Plain text only: no HTML, code, scripts, links with javascript, or new fields. Preserve unaffected sections. This is an unpublished suggestion." },
      { role: "user", content: JSON.stringify({ prompt, sectionId, document: current }) },
    ],
    max_tokens: 4096,
  });
  const parsed = jsonObject(aiText(result));
  if (!parsed || typeof parsed !== "object") throw new Error("Workers AI returned an invalid suggestion. No content was changed.");
  const value = parsed as Record<string, unknown>;
  rejectUnknownFields(value, ["document", "summary"], "No content was changed.");
  let document: SiteDocument;
  try {
    document = parseSiteDocument(value.document);
  } catch (error) {
    const reason = error instanceof Error && /unique|duplicate/i.test(error.message) ? `Duplicate section ids are not allowed. ` : "";
    throw new Error(`${reason}Workers AI returned an invalid document. No content was changed; edit the draft manually.`);
  }
  document.version = current.version + 1;
  const summary = typeof value.summary === "string" ? value.summary.slice(0, 500) : "Unpublished Workers AI suggestion; review before saving.";
  return { document, summary, source: "workers-ai" };
}

export async function suggestMailing(
  ai: WorkersAiBinding | undefined,
  input: { subject: string; body: string; prompt: string },
): Promise<{ subject: string; body: string; source: "workers-ai" }> {
  if (!ai) throw new Error("Workers AI is not configured. Bind env.AI to generate newsletter suggestions; the draft was not changed.");
  const result = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: "Return only JSON {subject,body}. Write a plain-text newsletter draft. No HTML/code, no claims of sending or subscribing anyone, and no fabricated events or statistics." },
      { role: "user", content: JSON.stringify(input) },
    ],
    max_tokens: 2048,
  });
  const value = jsonObject(aiText(result));
  if (!value || typeof value !== "object") throw new Error("Workers AI returned an invalid newsletter suggestion.");
  const record = value as Record<string, unknown>;
  rejectUnknownFields(record, ["subject", "body"], "The draft was not changed.");
  if (typeof record.subject !== "string" || typeof record.body !== "string") throw new Error("Workers AI omitted the newsletter subject or body.");
  if (hasUnsafeText(record.subject) || hasUnsafeText(record.body)) {
    throw new Error("Workers AI returned unsafe or code-like newsletter text. The draft was not changed.");
  }
  return { subject: record.subject.slice(0, 200), body: record.body.slice(0, 20_000), source: "workers-ai" };
}
