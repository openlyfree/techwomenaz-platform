"use client";

import { useEffect, useState } from "react";
import { Lock, Save, Settings2 } from "lucide-react";
import { mutate, useQuery, useSession } from "@/lib/api";
import type { Member, ProfileInput } from "@/lib/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeading,
} from "@/components/ui";
import {
  CheckboxField,
  SelectField,
  TextField,
} from "@/components/membership/form-fields";
import { normalizeSlots, safeError, validateProfile } from "@/components/membership/form-helpers";
import { timezoneOptions } from "@/components/membership/timezone";

function toProfile(member: Member): ProfileInput {
  return {
    name: member.name,
    participation: member.participation ?? "mentor",
    headline: member.headline,
    bio: member.bio,
    expertise: member.expertise ?? [],
    goals: member.goals ?? [],
    timezone: member.timezone,
    availability: member.availability ?? [],
    meetingFormat: member.meetingFormat,
    location: member.location,
    capacity: member.capacity,
    discoverable: member.discoverable,
    aiConsent: member.aiConsent,
    major: member.major ?? "",
    career: member.career ?? "",
    interests: member.interests ?? [],
    interestAnswer: member.interestAnswer ?? "",
  };
}

export default function PreferencesPage() {
  const session = useSession();
  const me = useQuery<Member | null>("membership.me");
  const [form, setForm] = useState<ProfileInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (me.data) {
      setForm(toProfile(me.data));
      setSaved(false);
      setError("");
    }
  }, [me.data]);

  const update = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
    setError("");
  };

  const save = async () => {
    if (!form) return;
    const payload: ProfileInput = { ...form, availability: normalizeSlots(form.availability) };
    const found = validateProfile(payload);
    if (Object.keys(found).length > 0) {
      setError("Complete your profile before changing these preferences: " + Object.values(found).join(" "));
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await mutate<Member>("membership.updateProfile", payload);
      setForm(toProfile(updated));
      setSaved(true);
      await me.refresh();
    } catch (saveError) {
      setError(safeError(saveError, "We could not save your preferences. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (session.loading) return <Loading message="Checking your session…" />;

  if (!session.user) {
    return (
      <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
        <div className="mx-auto w-full max-w-[640px]">
          <Card>
            <div className="flex flex-col gap-4">
              <Lock className="h-8 w-8 text-[#c2572a]" aria-hidden="true" />
              <h1 className="m-0 text-xl font-semibold">Sign in to manage preferences</h1>
              <p className="m-0 text-sm leading-6 text-[#5b6172]">Preference changes require a verified session.</p>
              <div><Button href="/login">Sign in</Button></div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (me.loading && !me.data) return <Loading message="Loading your preferences…" />;

  if (me.error && !me.data) {
    return (
      <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
        <div className="mx-auto w-full max-w-[640px]">
          <ErrorNotice
            message={safeError(me.error, "We could not load your preferences. Refresh the page to try again.")}
          />
        </div>
      </main>
    );
  }

  if (!me.data || !form) {
    return (
      <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
        <div className="mx-auto w-full max-w-[640px]">
          <EmptyState
            title="No preferences to show yet"
            description="Complete a membership application and profile first; your preferences will appear here."
          />
          <div className="mt-4"><Button href="/join">Apply to join</Button></div>
        </div>
      </main>
    );
  }

  const newsletterLabel: Record<Member["newsletterConsent"], string> = {
    unknown: "Not recorded",
    subscribed: "Subscribed",
    unsubscribed: "Not subscribed",
  };

  return (
    <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
        <PageHeading
          title="Preferences"
          description="Control how you appear in discovery and how you prefer to meet. These settings are saved to your profile."
        />

        {error ? <ErrorNotice message={error} /> : null}
        {saved ? (
          <p className="m-0 rounded-lg bg-[#eef7ee] p-3 text-sm text-[#2e7d32]" role="status">
            Preferences saved.
          </p>
        ) : null}

        <Card>
          <div className="flex flex-col gap-5">
            <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
              <Settings2 className="h-5 w-5 text-[#c2572a]" aria-hidden="true" />
              Discovery and meetings
            </h2>
            <CheckboxField
              id="prefs-discoverable"
              label="Visible in discovery"
              checked={form.discoverable}
              onChange={(checked) => update("discoverable", checked)}
              hint="Turning this off removes you from mentor and mentee search results."
            />
            <CheckboxField
              id="prefs-ai"
              label="Allow AI-assisted interest suggestions"
              checked={form.aiConsent}
              onChange={(checked) => update("aiConsent", checked)}
              hint="Optional. Interest categorization sends only your written answer, never your contact details."
            />
            <SelectField
              id="prefs-format"
              label="Meeting format"
              value={form.meetingFormat}
              onChange={(value) => update("meetingFormat", value as ProfileInput["meetingFormat"])}
              options={[
                { value: "online", label: "Online" },
                { value: "in-person", label: "In person" },
                { value: "either", label: "Either" },
              ]}
            />
            <SelectField
              id="prefs-timezone"
              label="Timezone"
              value={form.timezone}
              onChange={(value) => update("timezone", value)}
              options={timezoneOptions(form.timezone)}
            />
            <TextField
              id="prefs-location"
              label="Location"
              value={form.location}
              onChange={(value) => update("location", value)}
              hint="City or area, used for in-person matches."
            />
            <TextField
              id="prefs-capacity"
              label="Mentorship capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(value) => update("capacity", Number(value))}
            />
            <div>
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="mr-1 inline h-4 w-4" aria-hidden="true" />
                {saving ? "Saving…" : "Save preferences"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-lg font-semibold">Email and account</h2>
            <p className="m-0 text-sm leading-6 text-[#5b6172]">
              Newsletter: <Badge>{newsletterLabel[me.data.newsletterConsent]}</Badge>
            </p>
            <p className="m-0 text-xs leading-5 text-[#5b6172]">
              The join-form opt-in is recorded as your initial preference. This page does not
              subscribe or unsubscribe you; changing that record requires staff assistance.
              Adding interest tags never changes email subscriptions.
            </p>
            <p className="m-0 break-words text-sm text-[#5b6172]">Signed in as {session.user.email}</p>
            <div className="flex flex-wrap gap-3">
              <Button href="/portal/profile">Edit full profile</Button>
              <Button href="/login">Sign out and account options</Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
