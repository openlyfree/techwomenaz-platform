DO $$ BEGIN
  CREATE TYPE "public"."decision_role" AS ENUM('mentor', 'mentee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."decision_value" AS ENUM('interested', 'pass');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."match_status" AS ENUM('awaiting-coordinator', 'active', 'paused', 'completed', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."meeting_format" AS ENUM('online', 'in-person', 'either');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."member_role" AS ENUM('member', 'coordinator', 'editor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."member_status" AS ENUM('pending', 'approved', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."participation_role" AS ENUM('mentor', 'mentee', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"author_id" text NOT NULL,
	"met" boolean NOT NULL,
	"useful" boolean NOT NULL,
	"continue" boolean NOT NULL,
	"private_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content" (
	"id" integer PRIMARY KEY NOT NULL,
	"draft" jsonb DEFAULT '{"version":1,"theme":"desert","sections":[]}'::jsonb NOT NULL,
	"published" jsonb DEFAULT '{"version":1,"theme":"desert","sections":[]}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"document" jsonb NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"role" "decision_role" NOT NULL,
	"decision" "decision_value" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_actor_candidate_role_unique" UNIQUE("actor_id","candidate_id","role")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"end_date" text,
	"description" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"register_url" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"mentor_id" text NOT NULL,
	"mentee_id" text NOT NULL,
	"status" "match_status" DEFAULT 'awaiting-coordinator' NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"next_meeting" timestamp with time zone,
	"meeting_url" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"participation" "participation_role",
	"status" "member_status" DEFAULT 'pending' NOT NULL,
	"experience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expertise" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"availability" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'America/Phoenix' NOT NULL,
	"meeting_format" "meeting_format" DEFAULT 'either' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"major" text DEFAULT '' NOT NULL,
	"career" text DEFAULT '' NOT NULL,
	"interest_answer" text DEFAULT '' NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"discoverable" boolean DEFAULT false NOT NULL,
	"ai_consent" boolean DEFAULT false NOT NULL,
	"newsletter_consent" text DEFAULT 'unknown' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"member_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"photo" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "checkins" ADD CONSTRAINT "checkins_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "checkins" ADD CONSTRAINT "checkins_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "decisions" ADD CONSTRAINT "decisions_actor_id_members_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "decisions" ADD CONSTRAINT "decisions_candidate_id_members_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "matches" ADD CONSTRAINT "matches_mentor_id_members_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "matches" ADD CONSTRAINT "matches_mentee_id_members_id_fk" FOREIGN KEY ("mentee_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;