export interface HyperdriveBinding {
  connectionString: string;
}

export interface EmailBinding {
  send(message: unknown): Promise<void>;
}

export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Runtime bindings are optional until the controller adds them to cloudflare.config.ts. */
export interface PlatformBindings {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
  HYPERDRIVE?: HyperdriveBinding;
  EMAIL?: EmailBinding;
  AI?: WorkersAiBinding;
  EMAIL_FROM?: string;
  APP_ORIGIN?: string;
  TYPESAFE_API_KEY?: string;
  AI_GATEWAY_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  DEMO_MODE?: string;
}

export type RuntimeEnv = PlatformBindings & NodeJS.ProcessEnv;

export function runtimeEnv(bindings?: object): RuntimeEnv {
  return { ...process.env, ...bindings } as RuntimeEnv;
}

export function appOrigin(env: RuntimeEnv, request: Request): string {
  return (env.APP_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
}

export function integrationFlags(env: RuntimeEnv) {
  return {
    database: Boolean(env.HYPERDRIVE?.connectionString || env.DATABASE_URL),
    jev: Boolean(env.TYPESAFE_API_KEY),
    workersAi: Boolean(env.AI),
    email: Boolean(env.EMAIL && env.EMAIL_FROM),
    hubspot: false,
    turnstile: Boolean(env.TURNSTILE_SECRET_KEY),
    demo: env.DEMO_MODE === "true",
  };
}
