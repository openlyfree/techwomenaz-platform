-- Optional password credential for email+password sign-in.
ALTER TABLE "members" ADD COLUMN "password_hash" text;
