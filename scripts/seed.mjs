/**
 * Idempotent seed of clearly labeled synthetic/demo records only.
 * Never seeds credentials, magic-link tokens, sessions or privileged roles.
 * Run with: node --env-file=.env.local scripts/seed.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { redact } from "./migrate.mjs";

const createdAt = "2026-11-01T12:00:00Z";
const verifiedAt = "2026-11-02T15:30:00Z";

function makeDocument() {
  // Approved public copy: real TechWomenAZ branding with no fabricated
  // statistics, testimonials, events, or partner claims. Record-level
  // member/event/team/partner data stays honestly labeled as fictional.
  return {
    version: 1,
    theme: "desert",
    sections: [
      {
        id: "hero",
        type: "hero",
        title: "TechWomen Arizona",
        body: "Connecting women across Arizona who build, secure and lead in technology through mentorship, community and real opportunities.",
        enabled: true,
      },
      {
        id: "mission",
        type: "mission",
        title: "Our mission",
        body: "TechWomenAZ connects women in technology across Arizona. We pair mentors and mentees, host community events, and create space for students, career changers and seasoned engineers to learn from each other.",
        enabled: true,
      },
      {
        id: "mentorship",
        type: "mentorship",
        title: "Mentorship",
        body: "Set your weekly availability and meeting preferences, browse compatible profiles, and choose your own matches. Mentors and mentees decide together what to work on.",
        enabled: true,
      },
    ],
  };
}

/** Pure, deterministic plan; safe to inspect in tests without a database. */
export function buildSeedPlan() {
  const document = makeDocument();
  const members = [
    {
      id: "demo-mentor-001",
      email: "demo.mentor.001@example.invalid",
      name: "[fictional] Maya Mentor",
      role: "member",
      participation: "mentor",
      status: "approved",
      experience: ["Developer / Engineer"],
      expertise: ["React", "Career planning", "Application security"],
      goals: ["Help a first-generation engineer grow"],
      interests: ["Learning AI", "Networking"],
      availability: [
        { day: 2, start: "17:00", end: "18:00" },
        { day: 4, start: "12:00", end: "13:00" },
      ],
      headline: "[fictional] Staff engineer who mentors new developers",
      bio: "[fictional] Demo profile used for local development only.",
      timezone: "America/Phoenix",
      meetingFormat: "either",
      location: "Phoenix, AZ (synthetic)",
      major: "",
      career: "Staff Software Engineer (synthetic)",
      interestAnswer: "I joined to give back and explore applied AI.",
      capacity: 2,
      discoverable: true,
      aiConsent: false,
      newsletterConsent: "unknown",
      emailVerifiedAt: verifiedAt,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-mentee-002",
      email: "demo.mentee.002@example.invalid",
      name: "[fictional] Jordan Learner",
      role: "member",
      participation: "mentee",
      status: "approved",
      experience: [],
      expertise: [],
      goals: ["Break into tech", "Learn AI tooling"],
      interests: ["Finding a mentor", "Learning AI"],
      availability: [{ day: 2, start: "17:30", end: "18:30" }],
      headline: "[fictional] Career changer exploring software engineering",
      bio: "[fictional] Demo mentee used to exercise discovery locally.",
      timezone: "America/Phoenix",
      meetingFormat: "online",
      location: "Tucson, AZ (synthetic)",
      major: "Computer Science (synthetic)",
      career: "Student (synthetic)",
      interestAnswer: "I want a mentor and to meet people in tech.",
      // Two demo matches reference this mentee; both are active (no approval gate).
      capacity: 2,
      discoverable: true,
      aiConsent: false,
      newsletterConsent: "unknown",
      emailVerifiedAt: verifiedAt,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-both-003",
      email: "demo.both.003@example.invalid",
      name: "[fictional] Sam Both",
      role: "member",
      participation: "both",
      status: "approved",
      experience: ["Product Management"],
      expertise: ["Product discovery", "Mentoring"],
      goals: ["Give back", "Find a peer mentor"],
      interests: ["Networking", "Volunteering"],
      availability: [{ day: 3, start: "18:00", end: "19:00" }],
      headline: "[fictional] Product lead giving and receiving mentorship",
      bio: "[fictional] Demo profile for both mentor and mentee flows.",
      timezone: "America/Los_Angeles",
      meetingFormat: "either",
      location: "Remote (synthetic)",
      major: "",
      career: "Product Lead (synthetic)",
      interestAnswer: "Looking to volunteer and learn AI.",
      capacity: 1,
      discoverable: true,
      aiConsent: false,
      newsletterConsent: "unknown",
      emailVerifiedAt: verifiedAt,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-pending-004",
      email: "demo.pending.004@example.invalid",
      name: "[fictional] Priya Pending",
      role: "member",
      participation: "mentee",
      status: "pending",
      experience: [],
      expertise: [],
      goals: ["Learn about security careers"],
      interests: ["Finding a mentor"],
      availability: [{ day: 5, start: "16:00", end: "17:00" }],
      headline: "[fictional] Pending applicant awaiting email verification",
      bio: "[fictional] Demo pending application.",
      timezone: "America/Phoenix",
      meetingFormat: "online",
      location: "Phoenix, AZ (synthetic)",
      major: "Information Systems (synthetic)",
      career: "Student (synthetic)",
      interestAnswer: "Interested in networking and finding a mentor.",
      capacity: 1,
      discoverable: false,
      aiConsent: false,
      newsletterConsent: "unknown",
      emailVerifiedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const decisions = [
    {
      id: "demo-decision-001",
      actorId: "demo-mentor-001",
      candidateId: "demo-mentee-002",
      // role is the DESIRED candidate role, not the actor's role.
      role: "mentee",
      decision: "interested",
      createdAt,
    },
    {
      id: "demo-decision-002",
      actorId: "demo-mentee-002",
      candidateId: "demo-mentor-001",
      role: "mentor",
      decision: "interested",
      createdAt,
    },
    {
      id: "demo-decision-003",
      actorId: "demo-both-003",
      candidateId: "demo-mentee-002",
      role: "mentee",
      decision: "interested",
      createdAt,
    },
  ];

  const matches = [
    {
      id: "demo-match-001",
      mentorId: "demo-mentor-001",
      menteeId: "demo-mentee-002",
      status: "active",
      goal: "[synthetic] Explore AI-assisted development",
      nextMeeting: null,
      meetingUrl: "",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "demo-match-002",
      mentorId: "demo-both-003",
      menteeId: "demo-mentee-002",
      status: "active",
      goal: "[synthetic] Build a career switch plan",
      nextMeeting: "2026-12-01T18:00:00Z",
      meetingUrl: "https://example.invalid/meet",
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const checkins = [
    {
      id: "demo-checkin-001",
      matchId: "demo-match-002",
      authorId: "demo-mentee-002",
      met: true,
      useful: true,
      continue: true,
      privateNote: "[synthetic] Demo private note, visible only to its author.",
      createdAt,
    },
  ];

  const content = [
    { id: 1, draft: document, published: document, updatedAt: createdAt },
  ];

  const events = [
    {
      id: "demo-event-001",
      title: "[sample event] Finance Series: Money 101",
      date: "2026-12-10T18:00:00-07:00",
      endDate: null,
      description: "Illustrative event for this prototype. Registration link shown only as an example; confirm current events with the organizers before publishing.",
      location: "Online via Zoom",
      registerUrl: "https://example.invalid/register",
    },
  ];

  const team = [
    { id: "demo-team-001", name: "[fictional] Alex Rivera", role: "Community lead", photo: "" },
    { id: "demo-team-002", name: "[fictional] Dana Chen", role: "Programs chair", photo: "" },
  ];

  const partners = [
    { id: "demo-partner-001", name: "[fictional] Desert Ledger Accounting", logo: "", url: "https://example.invalid" },
    { id: "demo-partner-002", name: "[fictional] Cactus & Code Studio", logo: "", url: "https://example.invalid" },
  ];

  return {
    members,
    decisions,
    matches,
    checkins,
    content,
    events,
    team,
    partners,
    // Deliberately empty: no tokens, sessions, privileged roles or imports.
    authTokens: [],
    sessions: [],
    importBatches: [],
    newsletterDrafts: [],
  };
}

/** Insert with fixed ids so re-running the seed never duplicates records. */
export async function seedDatabase(client, plan = buildSeedPlan()) {
  await client.query("BEGIN");
  try {
    for (const m of plan.members) {
      await client.query(
        `INSERT INTO members (
           id, email, name, role, participation, status, experience, expertise, goals,
           interests, availability, headline, bio, timezone, meeting_format, location,
           major, career, interest_answer, capacity, discoverable, ai_consent,
           newsletter_consent, email_verified_at, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                   $20,$21,$22,$23,$24,$25,$26)
         ON CONFLICT (id) DO NOTHING`,
        [
          m.id, m.email, m.name, m.role, m.participation, m.status,
          JSON.stringify(m.experience), JSON.stringify(m.expertise),
          JSON.stringify(m.goals), JSON.stringify(m.interests),
          JSON.stringify(m.availability), m.headline, m.bio, m.timezone,
          m.meetingFormat, m.location, m.major, m.career, m.interestAnswer,
          m.capacity, m.discoverable, m.aiConsent, m.newsletterConsent,
          m.emailVerifiedAt, m.createdAt, m.updatedAt,
        ],
      );
    }
    for (const d of plan.decisions) {
      await client.query(
        `INSERT INTO decisions (id, actor_id, candidate_id, role, decision, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [d.id, d.actorId, d.candidateId, d.role, d.decision, d.createdAt],
      );
    }
    for (const m of plan.matches) {
      await client.query(
        `INSERT INTO matches (id, mentor_id, mentee_id, status, goal, next_meeting,
                              meeting_url, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.mentorId, m.menteeId, m.status, m.goal, m.nextMeeting, m.meetingUrl,
          m.createdAt, m.updatedAt],
      );
    }
    for (const c of plan.checkins) {
      await client.query(
        `INSERT INTO checkins (id, match_id, author_id, met, useful, continue,
                               private_note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.matchId, c.authorId, c.met, c.useful, c.continue, c.privateNote, c.createdAt],
      );
    }
    for (const c of plan.content) {
      await client.query(
        `INSERT INTO content (id, draft, published, updated_at)
         VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [c.id, JSON.stringify(c.draft), JSON.stringify(c.published), c.updatedAt],
      );
    }
    for (const e of plan.events) {
      await client.query(
        `INSERT INTO events (id, title, date, end_date, description, location, register_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [e.id, e.title, e.date, e.endDate, e.description, e.location, e.registerUrl],
      );
    }
    for (const t of plan.team) {
      await client.query(
        `INSERT INTO team (id, name, role, photo) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.name, t.role, t.photo],
      );
    }
    for (const p of plan.partners) {
      await client.query(
        `INSERT INTO partners (id, name, logo, url) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.logo, p.url],
      );
    }
    await client.query("COMMIT");
    return {
      members: plan.members.length,
      decisions: plan.decisions.length,
      matches: plan.matches.length,
      checkins: plan.checkins.length,
      content: plan.content.length,
      events: plan.events.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is not configured");
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const counts = await seedDatabase(client);
    console.log(
      `Synthetic seed complete (idempotent, no credentials): ${counts.members} members, ` +
        `${counts.matches} matches, ${counts.checkins} checkins, ${counts.content} content document, ` +
        `${counts.events} event.`,
    );
  } catch (error) {
    console.error(`Seed failed: ${redact(error instanceof Error ? error.message : error)}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) await main();
