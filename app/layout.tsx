import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/shell";

export const metadata: Metadata = {
  title: { default: "TechWomenAZ — Find your people. Grow your possibilities.", template: "%s · TechWomenAZ" },
  description: "A community supporting women in Arizona's tech ecosystem through mentorship, learning and meaningful connection. Independent hackathon preview.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><a href="#main-content" className="skip-link">Skip to content</a><SiteHeader />{children}<SiteFooter /></body>
    </html>
  );
}
