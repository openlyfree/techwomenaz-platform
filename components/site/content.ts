import type {
  EventRecord,
  PartnerRecord,
  PublicSite,
  SiteDocument,
  SiteSection,
  TeamRecord,
} from "@/lib/contracts";

export const BRAND = {
  cream: "#F8F3EE",
  blush: "#EFE4DD",
  sand: "#E7D7CC",
  surface: "#FFFBF8",
  ink: "#2E2620",
  muted: "#6B5E56",
  line: "#E1D2C7",
  orange: "#DE6219",
  orangeDeep: "#B84E10",
  orangeText: "#C85512",
  logoOrange: "#F07828",
  navy: "#22395A",
  apricot: "#E9A872",
} as const;

export const DISPLAY_FONT = '"Fraunces", Georgia, "Times New Roman", serif';
export const BODY_FONT = '"Jost", "Avenir Next", "Segoe UI", system-ui, sans-serif';

export const SITE_LINKS = {
  donate: "https://givebutter.com/VStKv8",
  membership: "https://forms.gle/qVG6HHXMBRN1axN96",
  email: "info@techwomenaz.org",
  instagram: "https://www.instagram.com/techwomenaz",
  linkedin: "https://www.linkedin.com/company/106737268/",
  candid: "https://app.candid.org/profile/9926254/tech-women-az-84-4682179/",
} as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function isPastEvent(event: EventRecord, now: Date = new Date()): boolean {
  const lastDate = parseDate(event.endDate) ?? parseDate(event.date);
  if (!lastDate) return false;
  return startOfDay(lastDate) < startOfDay(now);
}

export function partitionEvents(
  events: EventRecord[],
  now: Date = new Date(),
): { upcoming: EventRecord[]; past: EventRecord[] } {
  const upcoming: EventRecord[] = [];
  const past: EventRecord[] = [];
  for (const event of events) {
    (isPastEvent(event, now) ? past : upcoming).push(event);
  }
  const byDate = (a: EventRecord, b: EventRecord) =>
    (parseDate(a.date)?.getTime() ?? 0) - (parseDate(b.date)?.getTime() ?? 0);
  return { upcoming: upcoming.sort(byDate), past: past.sort((a, b) => byDate(b, a)) };
}

function formatDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatEventDateRange(event: EventRecord): string {
  const start = parseDate(event.date);
  if (!start) return "";
  const end = parseDate(event.endDate);
  if (!end) return formatDate(start);
  if (end.getTime() === start.getTime()) return formatDate(start);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
}

export function getEventBadge(event: EventRecord): { month: string; day: string } {
  const date = parseDate(event.date);
  return date ? { month: MONTHS[date.getMonth()], day: String(date.getDate()) } : { month: "", day: "—" };
}

/** Only allow known-safe link schemes; external content comes from the CMS. */
export function safeHref(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const href = value.trim();
  if (/^https?:\/\/[^\s/]+/i.test(href)) return href;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return href;
  if (/^tel:\+?[\d\s()-]+$/i.test(href)) return href;
  if (/^\/(?!\/)/.test(href) && !/[\r\n]/.test(href)) return href;
  if (href === "#" || /^#[A-Za-z][\w-]*$/.test(href)) return href;
  return undefined;
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function selectSections(
  document: SiteDocument,
  types: SiteSection["type"][],
  includeDisabled = false,
): SiteSection[] {
  return document.sections.filter(
    (item) => types.includes(item.type) && (includeDisabled || item.enabled),
  );
}

export interface ListBody {
  intro: string;
  items: { title: string; description: string }[];
}

/** CMS bodies are plain text; lines shaped "Title — description" become cards. */
export function parseListBody(body: string): ListBody {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const introLines: string[] = [];
  const items: ListBody["items"] = [];
  for (const line of lines) {
    const match = /^(.+?)\s+—\s+(.+)$/.exec(line);
    if (match && match[1] && match[2]) {
      items.push({ title: match[1], description: match[2] });
    } else {
      introLines.push(line);
    }
  }
  return { intro: introLines.join(" "), items };
}

function section(
  id: string,
  type: SiteSection["type"],
  title: string,
  body: string,
): SiteSection {
  return { id, type, title, body, enabled: true };
}

/**
 * Brand copy and records transcribed from the public techwomenaz.org site and
 * its public content/site.json. Used only, and labelled, when the live
 * `public.site` procedure cannot be reached.
 */
export function getDefaultSiteContent(): PublicSite {
  const document: SiteDocument = {
    version: 1,
    theme: "desert",
    sections: [
      section(
        "hero",
        "hero",
        "Empowering women in Arizona's tech ecosystem",
        "TechWomenAZ is a community committed to helping women thrive as leaders and innovators in technology through career development, mentorship, learning opportunities, and meaningful networking connections.",
      ),
      section(
        "story",
        "mission",
        "Our story",
        "Formerly the Phoenix chapter of Girls in Tech, we are now an independent nonprofit. When women in tech succeed, the entire Arizona ecosystem grows.",
      ),
      section(
        "who-we-are",
        "programs",
        "A place for you at every stage of your tech journey",
        "We are a community-led organization dedicated to supporting women at every stage of their tech journey, bringing global resources to the Arizona tech community. Whether you are a founder, an engineer, or just starting out, there is a place for you here.\n" +
          "Skill Development — Hands-on workshops covering everything from Generative AI to Leadership and Negotiation.\n" +
          "Leadership & Visibility — We shine a spotlight on local women leaders to inspire the next generation of Arizona.\n" +
          "Networking — Connect with a diverse network of professionals across Phoenix, Scottsdale, and the East Valley.\n" +
          "Inclusive Innovation — Bridging the gap between the classroom and the C-suite for women of all backgrounds.",
      ),
      section("events", "events", "Learn, connect, and grow with us", ""),
      section(
        "get-involved",
        "mentorship",
        "Help every woman in tech find a seat at the table",
        "By joining, you aren't just attending events. You are investing in the scholarships, venues, and mentorship programs that will sustain our community for years to come. Your support is the foundation for every workshop, every connection, and every career breakthrough.",
      ),
      section("team", "team", "The volunteers behind TechWomenAZ", ""),
      section("partners", "partners", "Thank you to our supporters", "Interested in sponsoring? Email us at info@techwomenaz.org."),
      section("contact", "contact", "Say hello", "Based in Phoenix, Arizona. Proudly serving the Valley of the Sun."),
    ],
  };

  const events: EventRecord[] = [
    {
      id: "twaz-finance-series-2026",
      title: "TWAZ Finance Series",
      date: "2026-10-26",
      endDate: "2026-11-16",
      description:
        "Free finance sessions to help you build confidence with money at every stage of life.\n" +
        "Oct 26 — Money 101: Building a Strong Financial Foundation\n" +
        "Nov 2 — Financial Education for Children: Start Them Strong\n" +
        "Nov 9 — Retirement Planning: Prepare Today, Enjoy Tomorrow\n" +
        "Nov 16 — Entrepreneurship: Turn Your Vision Into a Business",
      location: "Free · Online via Zoom · With Elevate Wealth Partners",
      registerUrl: "https://luma.com/52nzzzbq",
    },
  ];

  const team: TeamRecord[] = [
    { id: "aditi", name: "Aditi Madane", role: "Board Chair", photo: "https://techwomenaz.org/images/aditi.jpg" },
    { id: "mari", name: "Mari Gonzalez", role: "Board Vice-Chair", photo: "https://techwomenaz.org/images/mari.jpeg" },
    { id: "melissa-drake", name: "Melissa Drake", role: "Executive Director", photo: "https://techwomenaz.org/images/melissa.jpeg" },
    { id: "sruthi", name: "Sruthi Rajan", role: "Board Secretary", photo: "https://techwomenaz.org/images/sruthi.jpg" },
    { id: "melissa-diaz", name: "Melissa Diaz", role: "Treasurer", photo: "https://techwomenaz.org/images/melissa-diaz.webp" },
    { id: "zena", name: "Zena Alalak", role: "Recruitment Committee Chair", photo: "https://techwomenaz.org/images/zena.webp" },
    { id: "nelly", name: "Nelly Ayllon", role: "Marketing Committee Chair", photo: "https://techwomenaz.org/images/nelly.webp" },
    { id: "komal", name: "Komal Chhibbler", role: "Programs Committee Chair", photo: "https://techwomenaz.org/images/komal.jpeg" },
    { id: "marie", name: "Marie Willis", role: "Fundraising Committee Chair", photo: "https://techwomenaz.org/images/marie.webp" },
  ];

  const partners: PartnerRecord[] = [
    { id: "hra", name: "High Rock Accounting", logo: "https://techwomenaz.org/images/partner-hra.png", url: "" },
    { id: "wise-cat", name: "Wise Cat Business Services", logo: "https://techwomenaz.org/images/partner-2.png", url: "" },
    { id: "seluro", name: "Seluro", logo: "https://techwomenaz.org/images/partner-seluro.png", url: "" },
    { id: "csa", name: "CSA Arizona Chapter", logo: "https://techwomenaz.org/images/partner-4.jpg", url: "" },
  ];

  return { document, events, team, partners, demo: true };
}
