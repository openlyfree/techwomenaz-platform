import { Loading } from "@/components/ui";

// Minimal branded route-level Suspense fallback. Reuses the shared Loading
// component so the spinner and message stay consistent across the site.
export default function RouteLoading() {
  return (
    <main id="main-content" className="container flex min-h-[60vh] items-center justify-center">
      <Loading message="Getting things ready…" />
    </main>
  );
}
