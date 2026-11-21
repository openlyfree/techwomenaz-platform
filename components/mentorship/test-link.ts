import { createElement } from "react";
import type { AnchorHTMLAttributes } from "react";

/** Minimal next/link stand-in used only by component render tests. */
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children);
}
