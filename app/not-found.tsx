import Link from "next/link";
import { Sprout } from "lucide-react";

// Static 404 route. Kept a server component: no params/searchParams, no client state.
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="container section flex min-h-[65vh] flex-col items-center justify-center gap-6 text-center"
    >
      <div className="empty-icon" aria-hidden="true">
        <Sprout size={30} />
      </div>
      <p className="eyebrow">TechWomenAZ</p>
      <h1 className="max-w-2xl">Page not found</h1>
      <p className="text-muted max-w-md">
        That trail doesn&rsquo;t lead anywhere, but the community is still right here. Pick a path
        and keep exploring.
      </p>
      <nav className="flex flex-wrap justify-center gap-3" aria-label="Helpful links">
        <Link href="/" className="btn btn-primary">
          Home
        </Link>
        <Link href="/about" className="btn btn-outline">
          About
        </Link>
        <Link href="/events" className="btn btn-outline">
          Events
        </Link>
        <Link href="/join" className="btn btn-outline">
          Join us
        </Link>
      </nav>
    </main>
  );
}
