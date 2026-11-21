"use client";

import { Button } from "@/components/ui";

// Client error boundary that replaces the root layout, so it owns <html>/<body>.
// The raw error is intentionally never rendered: messages and stacks can expose
// internals. Only a friendly, actionable recovery path is shown.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <html lang="en">
      <body>
        <main
          id="main-content"
          className="container section flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center"
        >
          <div className="empty-icon" aria-hidden="true">
            !
          </div>
          <h1 className="max-w-2xl">Something went wrong</h1>
          <p className="text-muted max-w-md">
            We couldn&rsquo;t load this page right now. Your details are safe &mdash; try again and
            we&rsquo;ll pick up where you left off.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button href="/" variant="outline">
              Go home
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
