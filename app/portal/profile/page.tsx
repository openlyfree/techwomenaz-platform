"use client";

import { useEffect, useState } from "react";
import { Lock, Save, Sparkles } from "lucide-react";
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
  AsyncStatus,
  AvailabilityEditor,
  CheckboxField,
  FormErrorSummary,
  SelectField,
  TagEditor,
  TextAreaField,
  TextField,
} from "@/components/membership/form-fields";
import {
  mergeInterestSuggestions,
  normalizeSlots,
  safeError,
  validateProfile,
} from "@/components/membership/form-helpers";
import { timezoneOptions } from "@/components/membership/timezone";

function fromMember(member: Member): ProfileInput {
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

type Suggestions = {
  categories: string[];
  source: "jev" | "manual";
  notice: string | null;
};

export default function ProfilePage() {
  const session = useSession();
  const me = useQuery<Member | null>("membership.me");
  const [form, setForm] = useState<ProfileInput | null>(() => (me.data ? fromMember(me.data) : null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [categorizing, setCategorizing] = useState(false);

  useEffect(() => {
    if (me.data) {
      setForm(fromMember(me.data));
      setStatus(null);
      setErrors({});
    }
  }, [me.data]);

  const update = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: "", save: "" }));
    setStatus(null);
  };

  const categorize = async () => {
    if (!form) return;
    setCategorizing(true);
    setErrors((current) => ({ ...current, categorize: "" }));
    setStatus(null);
    try {
      const response = await mutate<Suggestions>("membership.categorize", {
        answer: form.interestAnswer,
      });
      setSuggestions(response);
      setStatus({
        message: response.notice ?? "Interest categories suggested. Review and add any you want.",
        tone: "success",
      });
    } catch (error) {
      const text = safeError(
        error,
        "Interest suggestions are unavailable right now. You can add your own interest tags below.",
      );
      setErrors((current) => ({ ...current, categorize: text }));
      setStatus({ message: text, tone: "error" });
    } finally {
      setCategorizing(false);
    }
  };

  const save = async () => {
    if (!form) return;
    const payload: ProfileInput = {
      ...form,
      availability: normalizeSlots(form.availability),
      expertise: form.expertise.map((item) => item.trim()).filter(Boolean),
      goals: form.goals.map((item) => item.trim()).filter(Boolean),
      interests: form.interests.map((item) => item.trim()).filter(Boolean),
    };
    const found = validateProfile(payload);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus(null);
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const updated = await mutate<Member>("membership.updateProfile", payload);
      setForm(fromMember(updated));
      setErrors({});
      setStatus({ message: "Profile saved. Your changes are now visible to matching.", tone: "success" });
      await Promise.allSettled([me.refresh(), session.refresh()]);
    } catch (error) {
      const text = safeError(
        error,
        "We could not save your profile. Check the fields and try again, or contact a coordinator.",
      );
      setErrors((current) => ({ ...current, save: text }));
      setStatus({ message: text, tone: "error" });
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
            <div className="flex flex-col gap-4 text-center sm:text-left">
              <Lock className="h-8 w-8 text-[#c2572a]" aria-hidden="true" />
              <h1 className="m-0 text-xl font-semibold">Sign in to edit your profile</h1>
              <p className="m-0 text-sm leading-6 text-[#5b6172]">
                Profiles are private to their owner. Request a sign-in link to continue.
              </p>
              <div><Button href="/login">Sign in</Button></div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (me.loading && !me.data) return <Loading message="Loading your profile…" />;

  if (me.error && !me.data) {
    return (
      <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
        <div className="mx-auto w-full max-w-[640px]">
          <ErrorNotice
            message={safeError(
              me.error,
              "We could not load your profile. Check the connection and refresh the page.",
            )}
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
            title="No profile application found"
            description="Your signed-in account has no membership application yet. Apply to join first, then return to complete your profile."
          />
          <div className="mt-4"><Button href="/join">Apply to join</Button></div>
        </div>
      </main>
    );
  }

  // Form-level notices are announced via AsyncStatus; only field errors go in the summary.
  const { save: _saveError, categorize: _categorizeError, ...fieldErrors } = errors;

  return (
    <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeading
          title="Your profile"
          description="Set your role, expertise, goals and weekly availability. Matching only considers compatible formats and times."
        />

        {me.error ? (
          <ErrorNotice message={safeError(me.error, "Your latest changes could not be refreshed. Your saved profile is shown below.")} />
        ) : null}
        <FormErrorSummary
          errors={fieldErrors}
          id="profile-form-errors"
          fieldIds={{ availability: "slot-start", meetingFormat: "profile-format" }}
        />
        <AsyncStatus message={status?.message ?? errors.save} tone={status?.tone ?? "error"} />

        <Card>
          <div className="flex flex-col gap-5">
            <h2 className="m-0 text-lg font-semibold">Basics</h2>
            <TextField id="profile-name" label="Name" value={form.name} onChange={(value) => update("name", value)} error={errors.name} autoComplete="name" />
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                id="profile-participation"
                label="I am joining as"
                value={form.participation}
                onChange={(value) => update("participation", value as ProfileInput["participation"])}
                options={[
                  { value: "mentor", label: "Mentor" },
                  { value: "mentee", label: "Mentee" },
                  { value: "both", label: "Both" },
                ]}
                error={errors.participation}
              />
              <SelectField
                id="profile-timezone"
                label="Timezone"
                value={form.timezone}
                onChange={(value) => update("timezone", value)}
                options={timezoneOptions(form.timezone)}
                error={errors.timezone}
                hint="Arizona stays on MST year-round (America/Phoenix)."
              />
            </div>
            <TextField id="profile-headline" label="Headline" value={form.headline} onChange={(value) => update("headline", value)} placeholder="e.g. Platform engineer and career changer" />
            <TextAreaField id="profile-bio" label="About you" value={form.bio} onChange={(value) => update("bio", value)} rows={4} />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField id="profile-major" label="Major (if studying)" value={form.major} onChange={(value) => update("major", value)} hint="Optional and editable." />
              <TextField id="profile-career" label="Career or current work" value={form.career} onChange={(value) => update("career", value)} hint="Optional and editable." />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-5">
            <h2 className="m-0 text-lg font-semibold">Experience and goals</h2>
            <TagEditor id="profile-expertise" label="Expertise" values={form.expertise} onChange={(values) => update("expertise", values)} hint="Add skills and experience you can share." />
            <TagEditor id="profile-goals" label="Goals" values={form.goals} onChange={(values) => update("goals", values)} hint="What you hope to learn or achieve." />
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-5">
            <h2 className="m-0 text-lg font-semibold">Meeting preferences</h2>
            <AvailabilityEditor slots={form.availability} onChange={(slots) => update("availability", slots)} error={errors.availability} />
            <SelectField
              id="profile-format"
              label="Meeting format"
              value={form.meetingFormat}
              onChange={(value) => update("meetingFormat", value as ProfileInput["meetingFormat"])}
              options={[
                { value: "online", label: "Online" },
                { value: "in-person", label: "In person" },
                { value: "either", label: "Either" },
              ]}
              error={errors.meetingFormat}
            />
            <TextField id="profile-location" label="Location" value={form.location} onChange={(value) => update("location", value)} hint="City or area, for in-person matches. Optional." />
            <TextField id="profile-capacity" label="Mentorship capacity" type="number" min={1} value={form.capacity} onChange={(value) => update("capacity", Number(value))} error={errors.capacity} hint="How many mentees you can support at once." />
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-5">
            <h2 className="m-0 text-lg font-semibold">Interests and consent</h2>
            <TextAreaField
              id="profile-interest-answer"
              label="Your answer in your own words"
              value={form.interestAnswer}
              onChange={(value) => update("interestAnswer", value)}
              hint="Used only to suggest interest categories. Your answer stays editable by you and staff."
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void categorize()} disabled={categorizing || form.interestAnswer.trim().length === 0}>
                  <Sparkles className="mr-1 inline h-4 w-4" aria-hidden="true" />
                  {categorizing ? "Categorizing…" : "Categorize interests"}
                </Button>
                {suggestions ? <Badge>{suggestions.source === "jev" ? "Jev suggestions" : "Manual categories"}</Badge> : null}
              </div>
              {suggestions?.notice ? <p className="m-0 text-xs leading-5 text-[#5b6172]">{suggestions.notice}</p> : null}
              {errors.categorize ? <p className="m-0 text-xs text-[#b3261e]" role="alert">{errors.categorize}</p> : null}
              {suggestions && suggestions.categories.length > 0 ? (
                <Button
                  onClick={() => update("interests", mergeInterestSuggestions(form.interests, suggestions.categories))}
                >
                  Add all suggested tags
                </Button>
              ) : null}
            </div>
            <TagEditor
              id="profile-interests"
              label="Interest tags"
              values={form.interests}
              onChange={(values) => update("interests", values)}
              suggestions={suggestions?.categories ?? []}
              hint="Suggestions are optional. Adding a tag never subscribes you to email or changes your application status."
            />
            <CheckboxField
              id="profile-discoverable"
              label="Show me in mentor or mentee discovery"
              checked={form.discoverable}
              onChange={(checked) => update("discoverable", checked)}
            />
            <CheckboxField
              id="profile-ai-consent"
              label="Allow AI-assisted suggestions for my profile"
              checked={form.aiConsent}
              onChange={(checked) => update("aiConsent", checked)}
              hint="Optional. Interest categorization sends only your answer, never your contact details."
            />
          </div>
        </Card>

        <div className="flex flex-wrap gap-3 pb-4">
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {saving ? "Saving…" : "Save profile"}
          </Button>
          <Button href="/portal/preferences">Preferences</Button>
        </div>
      </div>
    </main>
  );
}
