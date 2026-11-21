"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clipboard, Download, Plus, Sparkles } from "lucide-react";
import { mutate, query, useQuery, useSession } from "@/lib/api";
import type { NewsletterDraft } from "@/lib/contracts";
import { Badge, Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { errorText } from "@/components/admin/format";
import { exportFileName, hubspotCopyText, validateDraft } from "@/components/admin/mailing-utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]";
const inputClass =
  "mt-1 w-full min-h-[44px] rounded-[6px] border border-[#D9C6B9] bg-[#FFFBF8] px-3 py-2 text-[0.95rem] text-[#2E2620] placeholder:text-[#A2958B]";

export default function AdminMailingPage() {
  const session = useSession();
  const drafts = useQuery<NewsletterDraft[]>("mailing.drafts");
  const [draftId, setDraftId] = useState<string | undefined>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState<{ subject: string; body: string; source: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Only auto-load the first draft while nothing is selected. Once a draft is selected
    // or saved, a list refresh must never overwrite the copy currently in the composer.
    if (draftId || !drafts.data?.length) return;
    const first = drafts.data[0];
    setDraftId(first.id);
    setSubject(first.subject);
    setBody(first.body);
  }, [drafts.data, draftId]);

  const errors = validateDraft(subject, body);

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setFailure("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      setBusy("");
    }
  };

  const selectDraft = (draft: NewsletterDraft) => {
    setDraftId(draft.id);
    setSubject(draft.subject);
    setBody(draft.body);
    setSuggestion(null);
    setCopied(false);
    setNotice("");
    setFailure("");
  };

  const startNew = () => {
    setDraftId(undefined);
    setSubject("");
    setBody("");
    setSuggestion(null);
    setCopied(false);
    setNotice("New unsaved draft. Give it a subject and body, then save.");
    setFailure("");
  };

  if (session.loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10"><Loading label="Checking your staff session…" /></main>;
  }
  if (!session.user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <PageHeading title="Newsletter drafts" description="Sign in with a staff account to write member emails." />
        <Card className="mt-6 p-6">
          <p className="m-0 text-[#6B5E56]">No staff session was found. Drafts are private to staff.</p>
          <p className="mb-0 mt-4"><Link className={`inline-flex min-h-[44px] items-center rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white ${focusRing}`} href="/login">Sign in</Link></p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 grid gap-3 border-b border-[#E1D2C7] pb-6">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">TechWomenAZ · Communications</p>
        <PageHeading
          title="Newsletter drafts"
          description="Write a draft, copy it for a manual HubSpot paste, or export consented contacts. Nothing is sent from this page."
        />
        <div className="flex flex-wrap items-center gap-2"><Badge>Manual handoff</Badge><Badge>No email send</Badge></div>
      </header>

      {notice ? <p aria-live="polite" className="mb-4 rounded-[6px] border border-[#9BB99B] bg-[#F1F7EE] p-3 text-[0.92rem] text-[#2E4A2E]">{notice}</p> : null}
      {failure ? <div className="mb-4"><ErrorNotice message={failure} /></div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <section aria-labelledby="drafts-heading" className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="drafts-heading" className="m-0 text-[1.2rem] font-normal text-[#22395A]">Saved drafts</h2>
            <Button onClick={startNew} type="button"><Plus aria-hidden="true" className="mr-1.5 inline h-4 w-4" />New</Button>
          </div>
          {drafts.loading ? <Loading label="Loading drafts…" /> : null}
          {drafts.error ? <ErrorNotice message={errorText(drafts.error)} /> : null}
          {!drafts.loading && !drafts.error && !drafts.data?.length ? (
            <EmptyState title="No drafts yet" description="Start a new draft to write your first newsletter." />
          ) : null}
          <div className="grid gap-2">
            {(drafts.data ?? []).map((draft: NewsletterDraft) => (
              <Card className="min-w-0" key={draft.id}>
                <button
                  className={`grid w-full gap-1 p-4 text-left ${focusRing} ${draftId === draft.id ? "bg-[#FBEADF]" : ""}`}
                  onClick={() => selectDraft(draft)}
                  type="button"
                >
                  <span className="truncate text-[0.98rem] font-semibold text-[#22395A]">{draft.subject || "(no subject)"}</span>
                  <span className="line-clamp-2 text-[0.85rem] text-[#6B5E56]">{draft.body || "Empty body"}</span>
                  <span className="text-[0.75rem] text-[#8B7D73]">Updated {new Date(draft.updatedAt).toLocaleDateString()}</span>
                </button>
              </Card>
            ))}
          </div>
          <Card className="grid gap-3 p-4">
            <h3 className="m-0 text-[1rem] font-semibold text-[#22395A]">Consented contacts</h3>
            <p className="m-0 text-[0.85rem] leading-[1.55] text-[#6B5E56]">
              Export includes only members who explicitly consented. HubSpot still applies its own suppressions.
            </p>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void run("Preparing export", async () => {
                const result = await query<{ csv: string; count: number }>("mailing.exportContacts");
                const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = exportFileName(new Date().toISOString());
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(url);
                setNotice(`Exported ${result.count} consented contact${result.count === 1 ? "" : "s"}. Import the file into HubSpot manually.`);
              })}
              type="button"
            >
              <Download aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Export contacts CSV
            </Button>
          </Card>
        </section>

        <section aria-labelledby="composer-heading" className="grid content-start gap-4">
          <Card className="grid gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="composer-heading" className="m-0 text-[1.2rem] font-normal text-[#22395A]">
                {draftId ? "Edit draft" : "New draft"}
              </h2>
              {errors.length ? <Badge>{errors.length} field{errors.length === 1 ? "" : "s"} to fix</Badge> : <Badge>Ready</Badge>}
            </div>
            <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
              Subject
              <input className={inputClass} maxLength={200} onChange={(event) => { setSubject(event.target.value); setCopied(false); }} type="text" value={subject} />
            </label>
            <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
              Body
              <textarea className={`${inputClass} min-h-[260px]`} onChange={(event) => { setBody(event.target.value); setCopied(false); }} value={body} />
            </label>
            {errors.length ? (
              <ul className="m-0 grid list-disc gap-1 pl-5 text-[0.88rem] text-[#A33C15]" role="alert">
                {errors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={Boolean(busy) || errors.length > 0}
                onClick={() => void run("Saving draft", async () => {
                  const saved = await mutate<NewsletterDraft>("mailing.saveDraft", {
                    ...(draftId ? { id: draftId } : {}),
                    subject,
                    body,
                  });
                  setDraftId(saved.id);
                  setNotice("Draft saved.");
                  void drafts.refresh();
                })}
                type="button"
              >
                Save draft
              </Button>
              <Button
                disabled={Boolean(busy) || errors.length > 0}
                onClick={() => void run("Copying", async () => {
                  setCopied(false);
                  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
                    throw new Error("Clipboard is unavailable in this browser. Select the draft text and copy it manually.");
                  }
                  try {
                    await navigator.clipboard.writeText(hubspotCopyText(subject, body));
                  } catch {
                    throw new Error("Clipboard access was blocked. Select the draft text and copy it manually.");
                  }
                  setCopied(true);
                  setNotice("Copied as plain text. Paste into HubSpot and review before any send.");
                })}
                type="button"
              >
                {copied ? <Check aria-hidden="true" className="mr-1.5 inline h-4 w-4" /> : <Clipboard aria-hidden="true" className="mr-1.5 inline h-4 w-4" />}
                {copied ? "Copied for HubSpot" : "Copy for HubSpot"}
              </Button>
            </div>
            <p className="m-0 text-[0.8rem] leading-[1.5] text-[#6B5E56]">
              Copy is a manual handoff. No newsletter is sent, and no contact is subscribed by this page.
            </p>
          </Card>

          <Card className="grid gap-3 p-5">
            <h2 className="m-0 text-[1.1rem] font-semibold text-[#22395A]">Optional AI suggestion</h2>
            <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
              What should the draft do?
              <textarea className={`${inputClass} min-h-[90px]`} onChange={(event) => setPrompt(event.target.value)} value={prompt} />
            </label>
            <Button
              disabled={Boolean(busy) || !prompt.trim()}
              onClick={() => void run("Requesting suggestion", async () => {
                const result = await mutate<{ subject: string; body: string; source: string }>("mailing.suggest", { subject, body, prompt: prompt.trim() });
                setSuggestion(result);
                setNotice("Suggestion ready for review. Nothing was applied or sent.");
              })}
              type="button"
            >
              <Sparkles aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Suggest copy
            </Button>
            {suggestion ? (
              <div className="grid gap-3 rounded-[6px] border border-[#E1D2C7] bg-[#F8F3EE] p-4">
                <Badge>Source: {suggestion.source}</Badge>
                <p className="m-0 text-[0.9rem] text-[#22395A]"><strong>Subject:</strong> {suggestion.subject}</p>
                <p className="m-0 whitespace-pre-wrap text-[0.9rem] leading-[1.6] text-[#6B5E56]">{suggestion.body}</p>
                <Button onClick={() => { setSubject(suggestion.subject); setBody(suggestion.body); setCopied(false); setNotice("Suggestion applied to the draft. Review before saving."); }} type="button">
                  Use this suggestion
                </Button>
              </div>
            ) : null}
          </Card>
        </section>
      </div>
    </main>
  );
}
