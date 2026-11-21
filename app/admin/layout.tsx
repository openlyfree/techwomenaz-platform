import { WorkspaceShell } from "@/components/shell";
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell staff>{children}</WorkspaceShell>;
}
