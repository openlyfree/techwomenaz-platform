"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { mutate } from "@/lib/api";
import { EXPERIENCE_AREAS, INTEREST_AREAS, type JoinInput } from "@/lib/contracts";
import { Badge, Button, Card, ErrorNotice, PageHeading } from "@/components/ui";
import {
  CheckboxField,
  TagEditor,
  TextAreaField,
  TextField,
} from "@/components/membership/form-fields";
import { defaultJoinInput, safeError, validateJoin } from "@/components/membership/form-helpers";

export default function JoinPage() {
  const [input, setInput] = useState<JoinInput>(defaultJoinInput);
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; message: string } | null>(null);

  const update = <K extends keyof JoinInput>(key: K, value: JoinInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", submit: "" }));
  };

  const goToReview = () => {
    const found = validateJoin(input);
    const stepErrors: Record<string, string> = {};
    for (const key of ["name", "email", "experience"]) {
      if (found[key]) stepErrors[key] = found[key]!;
    }
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep(2);
  };

  const submit = async () => {
    const found = validateJoin(input);
    const stepErrors: Record<string, string> = {};
    for (const key of ["interests", "name", "email", "experience"]) {
      if (found[key]) stepErrors[key] = found[key]!;
    }
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setSubmitting(true);
    setErrors((current) => ({ ...current, submit: "" }));
    try {
      const response = await mutate<{ id: string; message: string }>("membership.join", input);
      setResult(response);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        submit: safeError(
          error,
          "We could not submit your application. Check the details and try again, or email the coordinators for help.",
        ),
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
        <div className="mx-auto w-full max-w-[640px]">
          <Card>
            <div className="flex flex-col gap-4">
              <CheckCircle2 className="h-10 w-10 text-[#2e7d32]" aria-hidden="true" />
              <h1 className="m-0 text-2xl font-semibold">Application received</h1>
              <p className="m-0 text-base leading-7 text-[#5b6172]">{result.message}</p>
              <p className="m-0 text-sm leading-6 text-[#5b6172]">
                Your application stays pending until you verify that you own this email address.
                Sign-in links are sent only when email delivery is configured on the site.
              </p>
              <p className="m-0 break-words text-xs text-[#8a8f9b]">Reference: {result.id}</p>
              <div className="flex flex-wrap gap-3">
                <Button href="/login">Continue to sign in</Button>
                <Button href="/">Back to home</Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
        <PageHeading
          title="Join TechWomenAZ"
          description="A short, two-step application. You can edit these details later from your profile."
        />

        <div className="flex items-center gap-2 text-sm text-[#5b6172]" aria-label="Form progress">
          <Badge>Step {step} of 2</Badge>
          <span>{step === 1 ? "About you" : "Interests and consent"}</span>
        </div>

        {errors.submit ? (
          <ErrorNotice message={errors.submit} />
        ) : null}

        <Card>
          {step === 1 ? (
            <div className="flex flex-col gap-5">
              <TextField
                id="join-name"
                label="Your name"
                value={input.name}
                onChange={(value) => update("name", value)}
                autoComplete="name"
                error={errors.name}
              />
              <TextField
                id="join-email"
                label="Email address"
                type="email"
                value={input.email}
                onChange={(value) => update("email", value)}
                autoComplete="email"
                hint="Used only for your single-use sign-in link and coordinator updates."
                error={errors.email}
              />
              <TagEditor
                id="join-experience"
                label="Experience areas"
                values={input.experience}
                onChange={(values) => update("experience", values)}
                suggestions={EXPERIENCE_AREAS}
                hint="Choose all that apply. Select Other if none fit."
              />
              {errors.experience ? <p className="text-xs text-[#b3261e]" role="alert">{errors.experience}</p> : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  id="join-major"
                  label="Major (if studying)"
                  value={input.major ?? ""}
                  onChange={(value) => update("major", value)}
                  hint="Optional; leave blank if not applicable."
                />
                <TextField
                  id="join-career"
                  label="Career or current work"
                  value={input.career ?? ""}
                  onChange={(value) => update("career", value)}
                  hint="Optional; helps us understand your background."
                />
              </div>
              <div>
                <Button onClick={goToReview}>
                  Continue <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <TagEditor
                id="join-interests"
                label="Interests"
                values={input.interests}
                onChange={(values) => update("interests", values)}
                suggestions={INTEREST_AREAS}
                hint="Pick suggested areas or add your own. These are editable later."
              />
              <TextAreaField
                id="join-interest-answer"
                label="What would you like to get out of TechWomenAZ?"
                value={input.interestAnswer ?? ""}
                onChange={(value) => update("interestAnswer", value)}
                placeholder="For example: find a mentor, learn AI, or meet peers in my field."
                hint="Free-text answers help us suggest categories. Suggestions never subscribe you to email or change your application status."
              />
              {errors.interests ? <p className="text-xs text-[#b3261e]" role="alert">{errors.interests}</p> : null}
              <CheckboxField
                id="join-newsletter"
                label="Email me the occasional newsletter"
                checked={input.newsletterConsent}
                onChange={(checked) => update("newsletterConsent", checked)}
                hint="Optional and off by default. Choosing it does not approve your application or alter matches."
              />
              <div className="rounded-lg border border-[#e6dfd5] bg-white p-3 text-sm leading-6 text-[#5b6172]">
                <p className="m-0 font-semibold text-[#1f2a44]">Before you submit</p>
                <p className="mb-0 mt-1 break-words">
                  {input.name || "Name not provided"} · {input.email || "Email not provided"}
                </p>
                <p className="mb-0 mt-1">
                  Experience: {input.experience.length ? input.experience.join(", ") : "None selected"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => submit()} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit application"}
                </Button>
                <Button onClick={() => setStep(1)} disabled={submitting}>
                  Back
                </Button>
              </div>
              <p className="m-0 flex items-start gap-2 text-xs leading-5 text-[#8a8f9b]">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                We never ask for a password here. After verifying your email you will use a
                single-use sign-in link.
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
