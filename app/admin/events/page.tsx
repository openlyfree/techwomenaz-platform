"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarPlus, ExternalLink, Pencil } from "lucide-react";
import { mutate, useQuery, useSession } from "@/lib/api";
import type { EventRecord } from "@/lib/contracts";
import { Badge, Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { describedBy, errorId, fieldId, touchTargetClass } from "@/components/admin/a11y-utils";
import { errorText, formatShortDate } from "@/components/admin/format";
import { emptyEvent, formatEventDate, sortEvents, validateEvent, type EventFormValues } from "@/components/admin/events-utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DE6219]";
const inputClass =
  "mt-1 w-full rounded-[6px] border border-[#D9C6B9] bg-[#FFFBF8] px-3 py-2 text-[0.95rem] text-[#2E2620] placeholder:text-[#A2958B] " +
  touchTargetClass;

export default function AdminEventsPage() {
  const session = useSession();
  const events = useQuery<EventRecord[]>("admin.events");
  const [form, setForm] = useState<EventFormValues>(emptyEvent);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    setNotice("");
    setFailure("");
  }, [editingId]);

  const errors = validateEvent(form);
  const ordered = sortEvents(events.data ?? []);

  // Map the flat validation messages to the field they belong to without changing
  // the frozen validateEvent contract. Each field gets its own alert + describedby.
  const messagesFor = (prefix: string) => errors.filter((message) => message.startsWith(prefix));
  const fieldErrors: Record<keyof EventFormValues, string[]> = {
    title: messagesFor("Add an event title"),
    date: messagesFor("Choose an event date"),
    description: messagesFor("Add a short description"),
    location: messagesFor("Add a location"),
    registerUrl: messagesFor("Registration link"),
  };
  const fieldErrorView = (name: keyof EventFormValues) =>
    fieldErrors[name].length ? (
      <p
        className="m-0 text-[0.82rem] font-normal normal-case tracking-normal text-[#A33C15]"
        id={errorId(name)}
        role="alert"
      >
        {fieldErrors[name].join(" ")}
      </p>
    ) : null;

  const startEdit = (event: EventRecord) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      date: event.date,
      description: event.description,
      location: event.location,
      registerUrl: event.registerUrl,
    });
  };

  const startNew = () => {
    setEditingId(undefined);
    setForm(emptyEvent());
  };

  if (session.loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10"><Loading label="Checking your staff session…" /></main>;
  }
  if (!session.user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        <PageHeading title="Events" description="Sign in with a staff account to manage public events." />
        <Card className="mt-6 p-6">
          <p className="m-0 text-[#6B5E56]">No staff session was found. Event administration is private to staff.</p>
          <p className="mb-0 mt-4"><Link className={`inline-flex min-h-[44px] items-center rounded-full bg-[#DE6219] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white ${focusRing}`} href="/login">Sign in</Link></p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 grid gap-3 border-b border-[#E1D2C7] pb-6">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#C85512]">TechWomenAZ · Programming</p>
        <PageHeading
          title="Events"
          description="Add and update events shown on the public site. Changes are saved only when you press Save event."
        />
        <div className="flex flex-wrap items-center gap-2"><Badge>Public listing</Badge><Badge>{ordered.length} event{ordered.length === 1 ? "" : "s"}</Badge></div>
      </header>

      {notice ? <p aria-live="polite" className="mb-4 rounded-[6px] border border-[#9BB99B] bg-[#F1F7EE] p-3 text-[0.92rem] text-[#2E4A2E]" role="status">{notice}</p> : null}
      {failure ? <div className="mb-4"><ErrorNotice message={failure} /></div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section aria-labelledby="list-heading" className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="list-heading" className="m-0 text-[1.2rem] font-normal text-[#22395A]">Listed events</h2>
            <div className="flex flex-wrap gap-2">
              <Button className={touchTargetClass} onClick={() => void events.refresh()} type="button">Refresh</Button>
              <Button className={touchTargetClass} onClick={startNew} type="button"><CalendarPlus aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Add event</Button>
            </div>
          </div>
          {events.loading ? <Loading label="Loading events…" /> : null}
          {events.error ? <ErrorNotice message={errorText(events.error)} /> : null}
          {!events.loading && !events.error && !ordered.length ? (
            <EmptyState title="No events listed" description="Add the first event so members can see what is coming up." />
          ) : null}
          {ordered.map((event) => (
            <Card className="grid min-w-0 gap-3 p-5" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid min-w-0 gap-1">
                  <h3 className="m-0 text-[1.15rem] font-semibold leading-[1.3] text-[#C85512]">{event.title}</h3>
                  <p className="m-0 text-[0.85rem] text-[#6B5E56]">{formatEventDate(event.date, event.endDate)} · {event.location}</p>
                </div>
                <Button
                  aria-label={`Edit ${event.title}`}
                  className={touchTargetClass}
                  onClick={() => startEdit(event)}
                  type="button"
                >
                  <Pencil aria-hidden="true" className="mr-1.5 inline h-4 w-4" />Edit
                </Button>
              </div>
              <p className="m-0 whitespace-pre-wrap text-[0.92rem] leading-[1.6] text-[#2E2620]">{event.description}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{new Date(event.date) >= new Date() ? "Upcoming" : "Past"}</Badge>
                {event.registerUrl ? (
                  <a
                    aria-label={`Registration link for ${event.title} (opens in a new tab)`}
                    className={`inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-[#22395A] underline underline-offset-4 ${focusRing} ${touchTargetClass}`}
                    href={event.registerUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Registration link <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-[0.85rem] text-[#8B7D73]">No registration link</span>
                )}
              </div>
            </Card>
          ))}
        </section>

        <section aria-labelledby="form-heading" className="grid content-start gap-3">
          <Card className="grid gap-4 p-5 lg:sticky lg:top-6">
            <div>
              <h2 id="form-heading" className="m-0 text-[1.2rem] font-normal text-[#22395A]">
                {editingId ? "Edit event" : "Add an event"}
              </h2>
              <p className="m-0 mt-1 text-[0.85rem] text-[#6B5E56]">
                {editingId ? `Editing ${formatShortDate(form.date)} listing.` : "Fields marked below are required."}
              </p>
            </div>
            <div className="grid gap-1">
              <label className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]" htmlFor={fieldId("title")}>Title</label>
              <input
                aria-describedby={describedBy([fieldErrors.title.length ? errorId("title") : undefined])}
                aria-invalid={fieldErrors.title.length > 0}
                className={`${inputClass} ${fieldErrors.title.length ? "border-[#A33C15]" : ""}`}
                id={fieldId("title")}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                type="text"
                value={form.title}
              />
              {fieldErrorView("title")}
            </div>
            <div className="grid gap-1">
              <label className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]" htmlFor={fieldId("date")}>Date</label>
              <input
                aria-describedby={describedBy([fieldErrors.date.length ? errorId("date") : undefined])}
                aria-invalid={fieldErrors.date.length > 0}
                className={`${inputClass} ${fieldErrors.date.length ? "border-[#A33C15]" : ""}`}
                id={fieldId("date")}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                type="date"
                value={form.date}
              />
              {fieldErrorView("date")}
            </div>
            <div className="grid gap-1">
              <label className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]" htmlFor={fieldId("description")}>Description</label>
              <textarea
                aria-describedby={describedBy([fieldErrors.description.length ? errorId("description") : undefined])}
                aria-invalid={fieldErrors.description.length > 0}
                className={`${inputClass} min-h-[120px] ${fieldErrors.description.length ? "border-[#A33C15]" : ""}`}
                id={fieldId("description")}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                value={form.description}
              />
              {fieldErrorView("description")}
            </div>
            <div className="grid gap-1">
              <label className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]" htmlFor={fieldId("location")}>Location (or “Online”)</label>
              <input
                aria-describedby={describedBy([fieldErrors.location.length ? errorId("location") : undefined])}
                aria-invalid={fieldErrors.location.length > 0}
                className={`${inputClass} ${fieldErrors.location.length ? "border-[#A33C15]" : ""}`}
                id={fieldId("location")}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                type="text"
                value={form.location}
              />
              {fieldErrorView("location")}
            </div>
            <div className="grid gap-1">
              <label className="text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-[#6B5E56]" htmlFor={fieldId("registerUrl")}>Registration URL (optional)</label>
              <input
                aria-describedby={describedBy([fieldErrors.registerUrl.length ? errorId("registerUrl") : undefined])}
                aria-invalid={fieldErrors.registerUrl.length > 0}
                className={`${inputClass} ${fieldErrors.registerUrl.length ? "border-[#A33C15]" : ""}`}
                id={fieldId("registerUrl")}
                inputMode="url"
                onChange={(event) => setForm({ ...form, registerUrl: event.target.value })}
                type="url"
                value={form.registerUrl}
              />
              {fieldErrorView("registerUrl")}
            </div>
            {errors.length ? (
              <div aria-label="Event form errors" className="grid gap-1 text-[0.88rem] text-[#A33C15]" role="alert">
                <p className="m-0 font-semibold">Please fix the following before saving:</p>
                <ul className="m-0 grid list-disc gap-1 pl-5">
                  {errors.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className={touchTargetClass}
                disabled={busy || errors.length > 0}
                onClick={async () => {
                  setBusy(true);
                  setFailure("");
                  setNotice("");
                  try {
                    const saved = await mutate<EventRecord>("admin.saveEvent", {
                      ...(editingId ? { id: editingId } : {}),
                      title: form.title.trim(),
                      date: form.date,
                      description: form.description.trim(),
                      location: form.location.trim(),
                      registerUrl: form.registerUrl.trim(),
                    });
                    setEditingId(saved.id);
                    setNotice("Event saved. The public listing will reflect this update.");
                    void events.refresh();
                  } catch (error) {
                    setFailure(errorText(error));
                  } finally {
                    setBusy(false);
                  }
                }}
                type="button"
              >
                Save event
              </Button>
              <Button className={touchTargetClass} onClick={startNew} type="button">Clear form</Button>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
