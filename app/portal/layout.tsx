import { WorkspaceShell } from "@/components/shell";
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
