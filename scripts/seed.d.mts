export {};

declare module "../scripts/seed.mjs" {
  export function buildSeedPlan(): Record<string, any> & {
    members: Array<Record<string, any>>;
    decisions: Array<Record<string, any>>;
    matches: Array<Record<string, any>>;
    checkins: Array<Record<string, any>>;
    content: Array<Record<string, any>>;
    events: Array<Record<string, any>>;
    team: Array<Record<string, any>>;
    partners: Array<Record<string, any>>;
  };
}
