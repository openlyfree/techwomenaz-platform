"use client";

import { useState } from "react";
import { ArrowRight, LogOut, Mail } from "lucide-react";
import { mutate, useSession } from "@/lib/api";
import { Badge, Button, Card, EmptyState, ErrorNotice, Loading, PageHeading } from "@/components/ui";
import { TextField } from "@/components/membership/form-fields";
import { safeError } from "@/components/membership/form-helpers";

export default function LoginPage() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const requestLink = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address you used on your application.");
      setMessage("");
      return;
    }
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await mutate<{ message: string }>("auth.requestLink", { email: email.trim() });
      setMessage(response.message || "Sign-in link request processed.");
    } catch (requestError) {
      setError(
        safeError(
          requestError,
          "We could not send a sign-in link. Email delivery may not be configured; ask the coordinators to check the email integration.",
        ),
      );
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
    } catch (signOutError) {
      setError(safeError(signOutError, "We could not sign you out. Please try again."));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf6ef] px-4 py-8 text-[#1f2a44] sm:px-6">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <PageHeading
          title="Sign in"
          description="We use single-use email links instead of passwords. Use the address from your membership application."
        />

        {session.error ? (
          <ErrorNotice
            message={safeError(
              session.error,
              "We could not check your session. Refresh the page or ask the coordinators for help.",
            )}
          />
        ) : null}
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
            <Card>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7e7df] text-[#c2572a]">
                    <Mail className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="m-0 text-base font-semibold">Request a sign-in link</h2>
                    <p className="m-0 text-sm text-[#5b6172]">The link expires and works once.</p>
                  </div>
                </div>
                <TextField
                  id="login-email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  placeholder="you@example.com"
                />
                <div>
                  <Button onClick={() => void requestLink()} disabled={sending}>
                    {sending ? "Requesting…" : <>Email me a sign-in link <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></>}
                  </Button>
                </div>
                {message ? (
                  <p className="m-0 rounded-lg bg-[#eef7ee] p-3 text-sm leading-6 text-[#2e7d32]" role="status">
                    {message}
                  </p>
                ) : null}
                <EmptyState
                  title="No email arrived?"
                  description="Links are sent only when email delivery is configured. If it is not configured, the request will report that honestly rather than pretending to send. Confirm you used your application address, or contact a coordinator."
                />
              </div>
            </Card>
            <p className="m-0 text-sm text-[#5b6172]">
              New here?{" "}
              <a className="font-semibold text-[#c2572a] underline" href="/join">
                Apply to join
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
