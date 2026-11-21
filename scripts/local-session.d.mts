export interface LocalBootstrapConfig {
  email: string;
  role: "member" | "coordinator" | "editor" | "admin";
  name: string;
  origin: string;
}

export interface SessionCredential {
  path: string;
  data: string;
  options: { mode: number };
}

export interface LocalBootstrapClient {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}

export interface LocalBootstrapDeps {
  env?: Record<string, string | undefined>;
  clientFactory?: () => LocalBootstrapClient;
  mkdir?: (path: string, options: object) => Promise<void>;
  writeFile?: (path: string, data: string, options: { mode: number }) => Promise<void>;
  log?: (message: string) => void;
  errorLog?: (message: string) => void;
}

export function bootstrapConfig(env?: Record<string, string | undefined>): LocalBootstrapConfig;
export function sessionCredential(
  config: LocalBootstrapConfig,
  memberId: string,
  token: string,
  expiresAt: Date,
): SessionCredential;
export function main(deps?: LocalBootstrapDeps): Promise<void>;
