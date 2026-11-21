"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { AlertCircle, ArrowRight, LoaderCircle, Sprout } from "lucide-react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string; variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode;
};
export function Button({ children, href, variant = "primary", size = "md", loading, icon, className = "", ...props }: ButtonProps) {
  const classes = `btn btn-${variant} btn-${size} ${className}`;
  if (href) return <Link href={href} className={classes}>{icon}{children}</Link>;
  return <button {...props} className={classes} disabled={props.disabled || loading}>
    {loading ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : icon}{children}
  </button>;
}
export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`card ${className}`}>{children}</div>;
}
export function Badge({ children, className = "", variant = "neutral" }: { children: ReactNode; className?: string; variant?: string }) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}
export function Field({ label, children, hint, error, htmlFor, className = "" }: { label: string; children: ReactNode; hint?: ReactNode; error?: string; htmlFor?: string; className?: string }) {
  return <div className={`field ${className}`}><label htmlFor={htmlFor}>{label}</label>{children}{hint && <p className="field-hint">{hint}</p>}{error && <p className="field-error" role="alert">{error}</p>}</div>;
}
export function EmptyState({ title = "Nothing here just yet", description, children, icon }: { title?: string; description?: string; children?: ReactNode; icon?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <Sprout size={28} />}</div><h3>{title}</h3>{description && <p>{description}</p>}{children}</div>;
}
export function Loading({ message, label }: { message?: string; label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle size={23} className="animate-spin" /><span>{message ?? label ?? "Getting things ready…"}</span></div>;
}
export function ErrorNotice({ message, children, onRetry }: { message?: string | null; children?: ReactNode; onRetry?: () => void }) {
  if (!message && !children) return null;
  return <div className="error-notice" role="alert"><AlertCircle size={20} /><div>{message}{children}{onRetry && <button className="text-link" onClick={onRetry}>Try again <ArrowRight size={14} /></button>}</div></div>;
}
export function PageHeading({ title, description, eyebrow, children, action }: { title: string; description?: string; eyebrow?: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="text-muted mt-3 max-w-2xl">{description}</p>}</div>{action ?? children}</div>;
}
export function StatCard({ label, value, hint, icon, change }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; change?: string }) {
  return <Card className="stat-card"><div className="flex items-center justify-between gap-3"><span className="text-sm text-muted">{label}</span>{icon && <span className="stat-icon">{icon}</span>}</div><strong className="stat-value">{value}</strong>{(hint || change) && <span className="text-xs text-muted">{hint ?? change}</span>}</Card>;
}
