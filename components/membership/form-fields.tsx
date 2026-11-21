"use client";

import { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  isValidSlot,
  MAX_AVAILABILITY_SLOTS,
  normalizeSlots,
  parseClock,
} from "./form-helpers";
import { formatSlotLabel, hasOverlap } from "./timezone";
import type { AvailabilitySlot } from "@/lib/contracts";

export const inputClass =
  "min-h-[44px] w-full rounded-lg border border-[#d8d2c8] bg-white px-3 py-2 text-base leading-6 text-[#1f2a44] placeholder:text-[#8a8f9b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2572a]";

const labelClass = "mb-1 block text-sm font-semibold text-[#1f2a44]";
const hintClass = "mt-1 block text-xs leading-5 text-[#5b6172]";
const errorClass = "mt-1 text-xs leading-5 text-[#b3261e]";

/** Stable ids let every control describe its hint and, when present, its error. */
export function describedById(id: string, hint?: string, error?: string): string | undefined {
  const ids: string[] = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className={hintClass}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={errorClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  error,
  required = false,
  autoComplete,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  min?: number;
  max?: number;
}) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={id}
        className={inputClass}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        name={id}
        className={`${inputClass} min-h-[88px] resize-y`}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  error?: string;
}) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={id}
        className={inputClass}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="w-full rounded-lg border border-[#e6dfd5] bg-[#fffdf9] p-3">
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          className="mt-1 h-5 w-5 shrink-0 accent-[#c2572a]"
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="text-sm leading-6 text-[#1f2a44]">
          {label}
          {hint ? (
            <span id={`${id}-hint`} className={hintClass}>
              {hint}
            </span>
          ) : null}
        </span>
      </label>
    </div>
  );
}

/** Editable chip list with optional suggested values; nothing is added automatically. */
export function TagEditor({
  id,
  label,
  values,
  onChange,
  suggestions = [],
  hint,
  error,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  hint?: string;
  error?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!values.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  };
  const available = suggestions.filter(
    (item) => !values.some((value) => value.toLowerCase() === item.toLowerCase()),
  );
  return (
    <div className="w-full">
      <span className={labelClass} id={`${id}-label`}>
        {label}
      </span>
      <div className="flex flex-wrap gap-2" aria-labelledby={`${id}-label`}>
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[#f7e7df] px-3 py-1 text-sm text-[#7a3c1d]"
          >
            {value}
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2572a]"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ))}
        {values.length === 0 ? <span className="text-sm text-[#8a8f9b]">None selected yet</span> : null}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          className={inputClass}
          value={draft}
          aria-labelledby={`${id}-label`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById(id, hint, error)}
          placeholder="Type a value and press Add"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(draft);
            }
          }}
        />
        <Button onClick={() => add(draft)} disabled={draft.trim().length === 0}>
          Add
        </Button>
      </div>
      {available.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {available.map((suggestion) => (
            <button
              key={suggestion}
              className="min-h-[44px] rounded-full border border-[#d8d2c8] bg-white px-3 py-1 text-sm text-[#5b6172] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2572a]"
              onClick={() => add(suggestion)}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      {hint ? (
        <span id={`${id}-hint`} className={hintClass}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={errorClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Weekly availability editor. Day numbers follow the contract: Sunday = 0. */
export function AvailabilityEditor({
  slots,
  onChange,
  error,
}: {
  slots: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
  error?: string;
}) {
  const [day, setDay] = useState("0");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [localError, setLocalError] = useState("");

  const currentSlots = Array.isArray(slots) ? slots : [];
  const atCap = currentSlots.length >= MAX_AVAILABILITY_SLOTS;
  const dayNumber = Number(day);
  const dayLabel = DAYS[dayNumber] ?? `Day ${day}`;

  const overlappingSaved = currentSlots.filter((slot) => {
    const slotStart = parseClock(slot.start);
    const slotEnd = parseClock(slot.end);
    return (
      slotStart !== null &&
      slotEnd !== null &&
      currentSlots.some((other) => {
        if (other === slot || other.day !== slot.day) return false;
        const otherStart = parseClock(other.start);
        const otherEnd = parseClock(other.end);
        return otherStart !== null && otherEnd !== null && slotStart < otherEnd && otherStart < slotEnd;
      })
    );
  });

  const addSlot = () => {
    if (atCap) {
      setLocalError(`You can keep up to ${MAX_AVAILABILITY_SLOTS} slots. Remove one before adding another.`);
      return;
    }
    const candidate = { day: dayNumber, start, end };
    const startMinutes = parseClock(start);
    const endMinutes = parseClock(end);
    if (startMinutes === null || endMinutes === null) {
      setLocalError("Enter both times as HH:MM (for example 09:00).");
      return;
    }
    if (endMinutes <= startMinutes) {
      setLocalError("End time must be after the start time.");
      return;
    }
    if (!isValidSlot(candidate)) {
      setLocalError("Choose a valid day and time range.");
      return;
    }
    if (
      currentSlots.some(
        (slot) => slot.day === candidate.day && slot.start === candidate.start && slot.end === candidate.end,
      )
    ) {
      setLocalError("You already added that slot. Choose a different time or day.");
      return;
    }
    const conflict = currentSlots.find((slot) => {
      if (slot.day !== candidate.day) return false;
      const slotStart = parseClock(slot.start);
      const slotEnd = parseClock(slot.end);
      return slotStart !== null && slotEnd !== null && slotStart < endMinutes && startMinutes < slotEnd;
    });
    if (conflict) {
      setLocalError(`That time overlaps ${formatSlotLabel(conflict)}. Choose a time that does not overlap.`);
      return;
    }
    setLocalError("");
    onChange(normalizeSlots([...currentSlots, candidate]));
  };

  const removeAt = (index: number) => {
    setLocalError("");
    onChange(currentSlots.filter((_, position) => position !== index));
  };

  const timeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSlot();
    }
  };

  return (
    <section
      className="w-full min-w-0"
      aria-labelledby="availability-label"
      aria-describedby={
        ["availability-hint", localError ? "availability-local-error" : null, error ? "availability-error" : null]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      <span className={labelClass} id="availability-label">
        Weekly availability
      </span>
      <p className={hintClass} id="availability-hint">
        Times are in the timezone you chose above. Sunday is day 0. Add up to {MAX_AVAILABILITY_SLOTS} non-overlapping weekly slots
        ({currentSlots.length} added).
      </p>
      <div
        className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
        aria-describedby="availability-hint"
      >
        <SelectField
          id="slot-day"
          label="Day"
          value={day}
          onChange={(value) => { setDay(value); setLocalError(""); }}
          options={DAYS.map((name, index) => ({ value: String(index), label: name }))}
        />
        <div className="min-w-0" onKeyDown={timeKeyDown}>
          <TextField id="slot-start" label="Start" type="time" value={start} onChange={(value) => { setStart(value); setLocalError(""); }} />
        </div>
        <div className="min-w-0" onKeyDown={timeKeyDown}>
          <TextField id="slot-end" label="End" type="time" value={end} onChange={(value) => { setEnd(value); setLocalError(""); }} />
        </div>
        <Button
          type="button"
          className="min-h-[44px] w-full md:w-auto"
          onClick={addSlot}
          disabled={atCap}
        >
          <Plus className="mr-1 inline h-4 w-4" aria-hidden="true" />
          {atCap ? "Slot limit reached" : "Add slot"}
        </Button>
      </div>
      {localError ? (
        <p id="availability-local-error" className="mt-2 text-xs leading-5 text-[#b3261e]" role="alert">
          {localError}
        </p>
      ) : null}
      {overlappingSaved.length > 1 ? (
        <p
          className="mt-2 flex items-start gap-2 rounded-lg border border-[#e6c987] bg-[#fff7e6] p-2 text-xs leading-5 text-[#7a5300]"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Some saved slots overlap ({overlappingSaved.map(formatSlotLabel).join("; ")}). Remove one so matching uses clear availability.
          </span>
        </p>
      ) : null}
      {error ? (
        <p id="availability-error" className="mt-2 text-xs leading-5 text-[#b3261e]" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2">
        {currentSlots.length === 0 ? (
          <li className="text-sm text-[#8a8f9b]">No slots added yet.</li>
        ) : (
          currentSlots.map((slot, index) => (
            <li
              key={`${index}-${slot.day}-${slot.start}-${slot.end}`}
              className="inline-flex min-h-[44px] max-w-full items-center gap-1 rounded-full border border-[#d8d2c8] bg-white px-3 py-1 text-sm text-[#1f2a44]"
            >
              <span className="break-words">{formatSlotLabel(slot)}</span>
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2572a]"
                aria-label={`Remove ${formatSlotLabel(slot)}`}
                onClick={() => removeAt(index)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs">Remove</span>
              </button>
            </li>
          ))
        )}
      </ul>
      <p className="sr-only" aria-live="polite">
        {dayLabel} {start} to {end}
      </p>
    </section>
  );
}

/**
 * Announced error summary shown at the top of a form after a failed submit.
 * Each message is a link to the field that needs attention; field errors stay
 * inline as well so the two cues reinforce each other.
 */
export function FormErrorSummary({
  errors,
  id = "form-error-summary",
  idPrefix,
  fieldIds,
}: {
  errors: Record<string, string>;
  id?: string;
  idPrefix?: string;
  fieldIds?: Record<string, string>;
}) {
  const entries = Object.entries(errors).filter(([, message]) => Boolean(message));
  if (entries.length === 0) return null;
  const targetFor = (key: string) => fieldIds?.[key] ?? (idPrefix ? `${idPrefix}-${key}` : key);
  return (
    <div
      id={id}
      className="rounded-lg border border-[#e6c987] bg-[#fff7e6] p-3 text-sm leading-6 text-[#7a5300]"
      role="alert"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
    >
      <p id={`${id}-title`} className="m-0 font-semibold">
        Please fix the following:
      </p>
      <ul className="mb-0 mt-1 list-disc pl-5">
        {entries.map(([key, message]) => (
          <li key={key}>
            <a className="underline" href={`#${targetFor(key)}`}>
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Persistent polite live region: both successful and failed async saves are announced. */
export function AsyncStatus({
  message,
  tone = "success",
  className = "",
}: {
  message?: string | null;
  tone?: "success" | "error";
  className?: string;
}) {
  const visible = Boolean(message);
  const toneClass =
    tone === "error"
      ? "rounded-lg bg-[#fff1f0] p-3 text-sm leading-6 text-[#b3261e]"
      : "rounded-lg bg-[#eef7ee] p-3 text-sm leading-6 text-[#2e7d32]";
  return (
    <div
      className={`${visible ? toneClass : "sr-only"} ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message ?? ""}
    </div>
  );
}
