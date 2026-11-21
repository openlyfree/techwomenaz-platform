"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, Pencil, Plus, RotateCcw, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { mutate, useQuery, useSession } from "@/lib/api";
import type { ContentState, PublicSite, SiteDocument, SiteSection } from "@/lib/contracts";
import SiteRenderer from "@/components/site/SiteRenderer";
import { Badge, Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import {
  SECTION_LABELS,
  ensureStableIds,
  isDraftDirty,
  reorderSections,
  revisionName,
  toggleSection,
  validateSections,
} from "@/components/admin/content-utils";
import { errorText } from "@/components/admin/format";

type Tab = "edit" | "preview" | "ai";
const TAB_ORDER: Tab[] = ["edit", "preview", "ai"];
const sectionTypes = Object.keys(SECTION_LABELS) as SiteSection["type"][];
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]";
const inputClass =
  "mt-1 w-full min-h-[44px] rounded-[6px] border border-[#D9C6B9] bg-[#FFFBF8] px-3 py-2 text-[0.95rem] text-[#2E2620] placeholder:text-[#A2958B]";

export default function AdminContentPage() {
  const session = useSession();
  const content = useQuery<ContentState>("content.state");
  const publicSite = useQuery<PublicSite>("public.site");
  const [tab, setTab] = useState<Tab>("edit");
  const [draft, setDraft] = useState<SiteDocument | null>(null);
  const [baseVersion, setBaseVersion] = useState<number>(0);
  const [addType, setAddType] = useState<SiteSection["type"]>("mission");
  const [prompt, setPrompt] = useState("");
  const [suggestSection, setSuggestSection] = useState("");
  const [candidate, setCandidate] = useState<{ document: SiteDocument; summary: string; source: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!content.data) return;
    setDraft(content.data.draft);
    setBaseVersion(content.data.draft.version);
  }, [content.data]);

  const dirty = useMemo(
    () => (draft && content.data ? isDraftDirty(draft, content.data.draft) : false),
    [draft, content.data],
  );
  const validation = useMemo(() => (draft ? validateSections(draft.sections) : []), [draft]);

  /** WAI-ARIA tabs: arrow/Home/End move between tabs and focus the new one. */
  const handleTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = TAB_ORDER.indexOf(tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % TAB_ORDER.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TAB_ORDER.length - 1;
    if (next === null) return;
    event.preventDefault();
    const value = TAB_ORDER[next];
    setTab(value);
    document.getElementById(`content-tab-${value}`)?.focus();
  };

  const updateSection = (id: string, patch: Partial<SiteSection>) => {
    setDraft((current) =>
      current ? { ...current, sections: current.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : current,
    );
  };

  const applyNewState = (state: ContentState, message: string) => {
    setDraft(state.draft);
    setBaseVersion(state.draft.version);
    setCandidate(null);
    setNotice(message);
    setFailure("");
    void content.refresh();
  };

  const conflictMessage = (text: string) => /conflict|changed since|out of date|stale|reload/i.test(text);

  const reloadFromServer = () => {
    setConflict(false);
    setFailure("");
    setNotice("");
    setCandidate(null);
    content.refresh();
  };

  const runAction = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setFailure("");
    setNotice("");
    setConflict(false);
    try {
      await action();
    } catch (error) {
      const text = errorText(error);
      setFailure(text);
      if (conflictMessage(text)) setConflict(true);
    } finally {
      setBusy("");
    }
  };

  const siteDataNotice = publicSite.loading ? (
    <Loading label="Loading live events, team and partners…" />
  ) : publicSite.error ? (
    <ErrorNotice message={`Live site data could not be loaded: ${errorText(publicSite.error)} The preview will show no events, team or partners.`} />
  ) : !publicSite.data ? (
    <EmptyState title="Live site data unavailable" description="Events, team and partners are not configured, so the preview shows empty sections." />
  ) : null;

  if (session.loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10"><Loading label="Checking your staff session…" /></main>;
  }
  if (!session.user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <PageHeading title="Site content" description="Sign in with a staff account to edit the public site." />
        <Card className="mt-6 p-6">
          <p className="m-0 text-[#6B5E56]">No staff session was found. Content is private to staff.</p>
          <p className="mb-0 mt-4"><Link className={`inline-flex min-h-[44px] items-center rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white ${focusRing}`} href="/login">Sign in</Link></p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 grid gap-3 border-b border-[#E1D2C7] pb-6">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">TechWomenAZ · Site content</p>
        <PageHeading
          title="Site content editor"
          description="Edit a draft, preview it on the real site renderer, then publish deliberately. Nothing is saved automatically."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Draft v{draft?.version ?? "—"}</Badge>
          {draft && content.data ? <Badge>{dirty ? "Unsaved changes" : "Saved draft"}</Badge> : null}
          {conflict ? <Badge>Version conflict — reload required</Badge> : null}
        </div>
      </header>

      {content.loading ? <Loading label="Loading site content…" /> : null}
      {content.error ? <ErrorNotice message={errorText(content.error)} /> : null}
      {!content.loading && !content.error && !content.data ? (
        <EmptyState title="Content is unavailable" description="The content service must be configured before staff can edit the site." />
      ) : null}

      {content.data && draft ? (
        <>
          <div
            aria-label="Content editor views"
            className="mb-5 flex flex-wrap gap-2"
            id="content-editor-tabs"
            onKeyDown={handleTabKeys}
            role="tablist"
          >
            {([
              { id: "edit", label: "Edit", icon: Pencil },
              { id: "preview", label: "Preview", icon: Eye },
              { id: "ai", label: "AI draft", icon: Sparkles },
            ] as { id: Tab; label: string; icon: typeof Pencil }[]).map(({ id, label, icon: Icon }) => (
              <button
                aria-controls={`content-panel-${id}`}
                aria-selected={tab === id}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${focusRing} ${
                  tab === id ? "border-[#DE6219] bg-[#DE6219] text-white" : "border-[#D9C6B9] bg-[#FFFBF8] text-[#C85512]"
                }`}
                id={`content-tab-${id}`}
                key={id}
                onClick={() => setTab(id)}
                role="tab"
                tabIndex={tab === id ? 0 : -1}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {notice ? <p aria-live="polite" className="mb-4 rounded-[6px] border border-[#9BB99B] bg-[#F1F7EE] p-3 text-[0.92rem] text-[#2E4A2E]">{notice}</p> : null}
          {failure ? <div className="mb-4"><ErrorNotice message={failure} /></div> : null}
          {conflict || (content.data && draft && draft.version !== content.data.draft.version) ? (
            <div className="mb-4">
              <ErrorNotice message="The server has a newer version of this content, so the last action was rejected. Reload to fetch the latest saved draft — this discards your unsaved local edits — then reapply your changes and retry.">
                <Button className="mt-3" onClick={reloadFromServer} type="button" variant="danger">
                  Reload from server
                </Button>
              </ErrorNotice>
            </div>
          ) : null}
          {busy ? <p aria-live="polite" className="mb-4 text-[0.9rem] text-[#6B5E56]">{busy}…</p> : null}

          {tab === "edit" ? (
            <div
              aria-labelledby="content-tab-edit"
              className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              id="content-panel-edit"
              role="tabpanel"
              tabIndex={0}
            >
              <section aria-label="Draft sections" className="grid gap-3">
                <Card className="grid gap-3 p-5">
                  <h2 className="m-0 text-[1.2rem] font-normal text-[#22395A]">Draft settings</h2>
                  <label className="grid gap-1 text-[0.82rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
                    Theme
                    <select
                      className={inputClass}
                      onChange={(event) => setDraft({ ...draft, theme: event.target.value as SiteDocument["theme"] })}
                      value={draft.theme}
                    >
                      <option value="desert">Desert</option>
                      <option value="navy">Navy</option>
                    </select>
                  </label>
                  <p className="m-0 text-[0.85rem] text-[#6B5E56]">Section ids are stable so previews and links keep working after reordering.</p>
                  <Button
                    onClick={() => setDraft({ ...draft, sections: ensureStableIds(draft.sections) })}
                    type="button"
                    variant="outline"
                  >
                    Normalize section ids
                  </Button>
                  <p className="m-0 text-[0.78rem] text-[#6B5E56]">Use this to assign missing ids and resolve duplicates before publishing.</p>
                </Card>

                {draft.sections.map((section, index) => (
                  <Card className="grid gap-3 p-5" key={section.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge>{SECTION_LABELS[section.type]}</Badge>
                        <span className="text-[0.75rem] text-[#8B7D73]">#{index + 1}</span>
                      </div>
                      <label className="inline-flex min-h-[44px] items-center gap-2 text-[0.85rem] text-[#22395A]">
                        <input
                          checked={section.enabled}
                          className="h-5 w-5 accent-[#DE6219]"
                          onChange={(event) => setDraft({ ...draft, sections: toggleSection(draft.sections, section.id) })}
                          type="checkbox"
                        />
                        Visible on site
                      </label>
                    </div>
                    <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
                      Title
                      <input className={inputClass} onChange={(event) => updateSection(section.id, { title: event.target.value })} type="text" value={section.title} />
                    </label>
                    <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
                      Body
                      <textarea className={`${inputClass} min-h-[130px]`} onChange={(event) => updateSection(section.id, { body: event.target.value })} value={section.body} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={index === 0} onClick={() => setDraft({ ...draft, sections: reorderSections(draft.sections, index, index - 1) })} type="button">
                        <ArrowUp aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Move up
                      </Button>
                      <Button disabled={index === draft.sections.length - 1} onClick={() => setDraft({ ...draft, sections: reorderSections(draft.sections, index, index + 1) })} type="button">
                        <ArrowDown aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Move down
                      </Button>
                      <Button onClick={() => setDraft({ ...draft, sections: draft.sections.filter((s) => s.id !== section.id) })} type="button">
                        <Trash2 aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Remove
                      </Button>
                    </div>
                    <p className="m-0 text-[0.75rem] text-[#8B7D73]">Stable id: <code>{section.id}</code></p>
                  </Card>
                ))}

                <Card className="grid gap-3 p-5">
                  <h2 className="m-0 text-[1.05rem] font-semibold text-[#22395A]">Add a section</h2>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
                      Type
                      <select className={inputClass} onChange={(event) => setAddType(event.target.value as SiteSection["type"])} value={addType}>
                        {sectionTypes.map((type) => <option key={type} value={type}>{SECTION_LABELS[type]}</option>)}
                      </select>
                    </label>
                    <Button
                      onClick={() => {
                        const added: SiteSection = { id: "", type: addType, title: "New section", body: "", enabled: false };
                        setDraft({ ...draft, sections: ensureStableIds([...draft.sections, added]) });
                      }}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Add section
                    </Button>
                  </div>
                </Card>
              </section>

              <aside aria-label="Publish and revisions" className="grid content-start gap-3">
                <Card className="grid gap-3 p-5">
                  <h2 className="m-0 text-[1.2rem] font-normal text-[#22395A]">Save and publish</h2>
                  {validation.length ? (
                    <ul className="m-0 grid list-disc gap-1 pl-5 text-[0.88rem] text-[#A33C15]" role="alert">
                      {validation.map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  ) : (
                    <p className="m-0 text-[0.88rem] text-[#6B5E56]">Draft looks ready to save. Publishing is a separate, explicit step.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={Boolean(busy) || !dirty}
                      onClick={() => void runAction("Saving draft", async () => {
                        const state = await mutate<ContentState>("content.save", { document: draft, baseVersion });
                        applyNewState(state, "Draft saved. Publish when you are ready.");
                      })}
                      type="button"
                    >
                      <Save aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Save draft
                    </Button>
                    <Button
                      disabled={Boolean(busy) || validation.length > 0 || dirty}
                      onClick={() => void runAction("Publishing", async () => {
                        if (validation.length) {
                          setFailure("Fix the validation errors above before publishing.");
                          return;
                        }
                        if (dirty) {
                          setFailure("Save your draft before publishing so your latest edits go live.");
                          return;
                        }
                        const state = await mutate<ContentState>("content.publish", { baseVersion });
                        applyNewState(state, "Published. The live site now uses this version.");
                      })}
                      type="button"
                    >
                      <Send aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Publish
                    </Button>
                    <Button onClick={reloadFromServer} type="button">Reload from server</Button>
                  </div>
                  {dirty ? (
                    <p className="m-0 text-[0.8rem] leading-[1.5] text-[#A33C15]">
                      You have unsaved edits. Save the draft before publishing — publish uses the last saved version, not unsaved local changes.
                    </p>
                  ) : null}
                  <p className="m-0 text-[0.8rem] leading-[1.5] text-[#6B5E56]">
                    Saving, publishing and rollback all use base version {baseVersion} and refresh from the server on success. If another editor changes the site first, the server rejects the write and the reload action above becomes available.
                  </p>
                </Card>

                <Card className="grid gap-3 p-5">
                  <h2 className="m-0 text-[1.05rem] font-semibold text-[#22395A]">Published version</h2>
                  <p className="m-0 text-[0.88rem] text-[#6B5E56]">{revisionName(content.data.published)} · {content.data.published.sections.filter((s: SiteSection) => s.enabled).length} visible sections</p>
                  <h3 className="m-0 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">Revision history</h3>
                  {content.data.revisions.length ? (
                    <ul className="m-0 grid gap-2">
                      {content.data.revisions.map((revision: ContentState["revisions"][number]) => (
                        <li className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[#F8F3EE] p-3" key={revision.id}>
                          <span className="text-[0.88rem] text-[#22395A]">{revision.name} · v{revision.version}</span>
                          <Button
                            disabled={Boolean(busy)}
                            onClick={() => void runAction("Rolling back", async () => {
                              const state = await mutate<ContentState>("content.rollback", { revisionId: revision.id, baseVersion });
                              applyNewState(state, `Rolled back to ${revision.name}. Review and publish when ready.`);
                            })}
                            type="button"
                          >
                            <RotateCcw aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Roll back
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 text-[0.88rem] text-[#6B5E56]">No saved revisions yet.</p>
                  )}
                </Card>
              </aside>
            </div>
          ) : null}

          {tab === "preview" ? (
            <section
              aria-label="Draft preview"
              aria-labelledby="content-tab-preview"
              className="grid gap-3"
              id="content-panel-preview"
              role="tabpanel"
              tabIndex={0}
            >
              <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                <p className="m-0 text-[0.9rem] text-[#6B5E56]">Preview uses the live site renderer. Disabled sections are outlined and labeled for staff only.</p>
                <Badge>Preview · not published</Badge>
              </Card>
              {siteDataNotice}
              <div className="overflow-hidden rounded-[6px] border border-[#E1D2C7] bg-white">
                <SiteRenderer
                  document={draft}
                  events={publicSite.data?.events ?? []}
                  partners={publicSite.data?.partners ?? []}
                  preview
                  team={publicSite.data?.team ?? []}
                />
              </div>
            </section>
          ) : null}

          {tab === "ai" ? (
            <section
              aria-label="AI draft suggestions"
              aria-labelledby="content-tab-ai"
              className="grid gap-4 lg:grid-cols-2"
              id="content-panel-ai"
              role="tabpanel"
              tabIndex={0}
            >
              <div className="lg:col-span-2">{siteDataNotice}</div>
              <Card className="grid content-start gap-3 p-5">
                <h2 className="m-0 text-[1.2rem] font-normal text-[#22395A]">Ask for a draft</h2>
                <p className="m-0 text-[0.88rem] leading-[1.6] text-[#6B5E56]">
                  AI returns a candidate document for review. It never saves or publishes on its own.
                </p>
                <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
                  Section (optional)
                  <select className={inputClass} onChange={(event) => setSuggestSection(event.target.value)} value={suggestSection}>
                    <option value="">Whole document</option>
                    {draft.sections.map((section) => <option key={section.id} value={section.id}>{SECTION_LABELS[section.type]} — {section.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]">
                  What should change?
                  <textarea className={`${inputClass} min-h-[120px]`} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. Make the mentorship copy warmer and shorter" value={prompt} />
                </label>
                <Button
                  disabled={Boolean(busy) || !prompt.trim()}
                  onClick={() => void runAction("Requesting suggestion", async () => {
                    const result = await mutate<{ document: SiteDocument; summary: string; source: string }>("content.suggest", {
                      baseVersion,
                      prompt: prompt.trim(),
                      ...(suggestSection ? { sectionId: suggestSection } : {}),
                    });
                    setCandidate(result);
                    setNotice("Candidate ready. Review it below — nothing has been saved or published.");
                  })}
                  type="button"
                >
                  <Sparkles aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Suggest changes
                </Button>
              </Card>
              <Card className="grid content-start gap-3 p-5">
                <h2 className="m-0 text-[1.05rem] font-semibold text-[#22395A]">Candidate review</h2>
                {!candidate ? (
                  <EmptyState title="No candidate yet" description="Ask for a suggestion to see a reviewable draft here." />
                ) : (
                  <>
                    <p className="m-0 text-[0.88rem] text-[#6B5E56]">{candidate.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Source: {candidate.source}</Badge>
                      <Badge>Unreviewed · not saved or published</Badge>
                    </div>
                    <div className="max-h-[420px] overflow-auto rounded-[6px] border border-[#E1D2C7] bg-white">
                      <SiteRenderer
                        document={candidate.document}
                        events={publicSite.data?.events ?? []}
                        partners={publicSite.data?.partners ?? []}
                        preview
                        team={publicSite.data?.team ?? []}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        setDraft(candidate.document);
                        setTab("edit");
                        setNotice("Candidate applied to your draft. Save or publish explicitly.");
                      }}
                      type="button"
                    >
                      <Check aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Apply to draft
                    </Button>
                  </>
                )}
              </Card>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
