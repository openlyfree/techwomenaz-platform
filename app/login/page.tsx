"use client";

import { useState } from "react";
import { ArrowRight, LogOut, Mail, LockKeyhole } from "lucide-react";
import { mutate, useSession } from "@/lib/api";
import { Badge, Button, Card, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { AsyncStatus, FormErrorSummary, TextField } from "@/components/membership/form-fields";
import { safeError } from "@/components/membership/form-helpers";

export default function LoginPage() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [signingOut, setSigningOut] = useState(false);
  const [mode, setMode] = useState<"password" | "link">("password");

  const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const signIn = async () => {
    const errors: Record<string, string> = {};
    if (!validEmail()) errors.email = "Enter the email address you used on your application.";
    if (mode === "password" && password.length === 0) errors.password = "Enter your password.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setMessage("");
      setError("");
      return;
    }
    setSending(true);
    setFieldErrors({});
    setMessage("");
    setError("");
    try {
      if (mode === "password") {
        await mutate<{ success: true; name: string }>("auth.signIn", { email: email.trim(), password });
        await session.refresh();
        setMessage("Signed in. Opening your workspace…");
      } else {
        const response = await mutate<{ message: string }>("auth.requestLink", { email: email.trim() });
        setMessage(response.message || "Sign-in link request processed.");
      }
    } catch (failure) {
      const text = safeError(
        failure,
        mode === "password"
          ? "We could not sign you in. Check your email and password and try again."
          : "We could not send a sign-in link. Email delivery may not be configured; ask the coordinators to check the email integration.",
      );
      setError(text);
      setFieldErrors({ [mode === "password" ? "password" : "email"]: text });
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setError("");
    try {
      await mutate<{ success: true }>("auth.signOut", {});
      await session.refresh();
    } catch (failure) {
      setError(safeError(failure, "We could not sign you out. Please try again."));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <PageHeading
          title="Sign in"
          description="Use your email and password, or request a single-use sign-in link if email delivery is configured."
        />

        {session.error ? <ErrorNotice message={safeError(session.error, "We could not check your session. Refresh the page or ask the coordinators for help.")} /> : null}
        {error ? <ErrorNotice message={error} /> : null}

        {session.loading ? (
          <Loading message="Checking your session…" />
        ) : session.user ? (
          <Card>
            <div className="flex flex-col gap-4">
              <Badge>Signed in</Badge>
              <h2 className="m-0 text-xl font-semibold">Welcome back, {session.user.name}</h2>
              <p className="m-0 break-words text-sm text-[#5b6172]">{session.user.email}</p>
              <div className="flex flex-wrap gap-3">
                <Button href="/portal">Go to your portal</Button>
                <Button onClick={() => void signOut()} disabled={signingOut}>
                  {signingOut ? "Signing out…" : <><LogOut className="mr-1 inline h-4 w-4" aria-hidden="true" /> Sign out</>}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <FormErrorSummary errors={fieldErrors} id="login-form-errors" idPrefix="login" />
            <AsyncStatus message={message} tone="success" />
            <Card>
              <div className="flex flex-col gap-5">
                <div className="flex gap-2" role="tablist" aria-label="Sign-in method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "password"}
                    onClick={() => { setMode("password"); setFieldErrors({}); setError(""); }}
                    className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[13px] font-semibold ${mode === "password" ? "border-[#c2572a] bg-[#c2572a] text-white" : "border-[#d8d2c8] bg-white text-[#5b6172]"}`}
                  >
                    <LockKeyhole className="h-4 w-4" aria-hidden="true" /> Email &amp; password
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "link"}
                    onClick={() => { setMode("link"); setFieldErrors({}); setError(""); }}
                    className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[13px] font-semibold ${mode === "link" ? "border-[#c2572a] bg-[#c2572a] text-white" : "border-[#d8d2c8] bg-white text-[#5b6172]"}`}
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" /> Email link
                  </button>
                </div>

                <TextField
                  id="login-email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  placeholder="you@example.com"
                  hint="Use the address from your application."
                  error={fieldErrors.email}
                />
                {mode === "password" ? (
                  <TextField
                    id="login-password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    placeholder="Your password"
                    hint="At least 8 characters. Set when you applied, or ask a coordinator to reset it."
                    error={fieldErrors.password}
                  />
                ) : null}
                <div>
                  <Button onClick={() => void signIn()} disabled={sending}>
                    {sending ? "Signing in…" : <>{mode === "password" ? "Sign in" : "Email me a sign-in link"} <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></>}
                  </Button>
                </div>
                {mode === "link" ? (
                  <p className="m-0 text-sm text-[#5b6172]">
                    Links are sent only when email delivery is configured. If it is not, the request reports that honestly rather than pretending to send. Password sign-in works without email delivery.
                  </p>
                ) : null}
              </div>
            </Card>
            <p className="m-0 text-sm text-[#5b6172]">
              New here?{" "}
              <a className="font-semibold text-[#c2572a] underline" href="/join">
                Apply to join
              </a>
              {" — you can set a password on the application form."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
