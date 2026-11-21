# Frozen UI/API contract v1

All procedures use tRPC at /api/trpc. Input/output types are lib/contracts.ts. query<T>(name,input) and mutate<T>(name,input) are exported by lib/api.ts. Role checks live on server. Safe error text shown by UI. Auth uses /api/auth/* Better Auth where configured; session query is always available. No privileged demo bypass endpoint.

## Public and authentication
- query public.site → PublicSite
- mutation membership.join(JoinInput) → {id:string,message:string}; remains pending until email ownership verified.
- query auth.session → SessionUser|null
- mutation auth.requestLink({email:string}) → {message:string}; real email transport required; never return the magic token in deployed response.
- mutation auth.signOut({}) → {success:true}

## Member
- query membership.me → Member|null
- mutation membership.updateProfile(ProfileInput) → Member
- query mentorship.discover({role:'mentor'|'mentee'}) → DiscoveryResult
- mutation mentorship.decide({candidateId:string,role:'mentor'|'mentee',decision:'interested'|'pass'}) → {mutual:boolean,matchId?:string}
- query mentorship.matches → Match[]
- mutation mentorship.updateMatch({id:string,goal?:string,nextMeeting?:string,meetingUrl?:string,status?:'paused'|'completed'}) → Match
- query mentorship.checkins({matchId:string}) → Checkin[] (private notes restricted)
- mutation mentorship.checkin({matchId:string,met:boolean,useful:boolean,continue:boolean,privateNote:string}) → Checkin

## Staff
- query admin.stats → Statistics
- query admin.members → Member[] (email only to authorized staff)
- mutation admin.approveMember({id:string,status:'approved'|'paused'}) → {success:true}
- query admin.matches → Match[]
- mutation admin.approveMatch({id:string,approve:boolean}) → Match
- mutation imports.preview({csv:string}) → ImportPreview
- mutation imports.commit({token:string}) → {imported:number,duplicates:number}
- query content.state → ContentState
- mutation content.save({document:SiteDocument,baseVersion:number}) → ContentState
- mutation content.suggest({prompt:string,sectionId?:string,baseVersion:number}) → {document:SiteDocument,summary:string,source:'workers-ai'}; no auto-save/publish
- mutation content.publish({baseVersion:number}) → ContentState
- mutation content.rollback({revisionId:string,baseVersion:number}) → ContentState
- query mailing.drafts → NewsletterDraft[]
- mutation mailing.saveDraft({id?:string,subject:string,body:string}) → NewsletterDraft
- mutation mailing.suggest({subject:string,body:string,prompt:string}) → {subject:string,body:string,source:'workers-ai'}
- query mailing.exportContacts → {csv:string,count:number}; only explicitly consented; HubSpot still enforces suppressions
- query admin.integrations → {database:boolean,jev:boolean,workersAi:boolean,email:boolean,hubspot:boolean,turnstile:boolean,demo:boolean}
- mutation membership.categorize({answer:string}) → {categories:string[],source:'jev'|'manual',notice:string|null}; narrow canonical interests, suggested only, no contact data sent to Jev
- query admin.events → EventRecord[]
- mutation admin.saveEvent({id?:string,title:string,date:string,description:string,location:string,registerUrl:string}) → EventRecord

Shared root navigation links: /, /about, /events, /mentorship, /join, /login, /portal, /portal/profile, /portal/discover, /portal/relationships/[id], /admin, /admin/members, /admin/imports, /admin/mentorship, /admin/content, /admin/mailing, /admin/reports, /admin/events, /admin/settings. Leaf pages exported default. Wrappers/layouts owned by controller; each leaf uses the shared shell automatically.

UI owners use lib/api.ts hooks/helpers, import DTOs only as types. Missing session: show login action, never invent a user. Integration errors explain configuration honestly. Synthetic profiles must be labeled as demo; counts are queried from Postgres.

Correction: nonprofit screenshot text has NOT been verified. Mutual Interested decisions activate a match directly; the former coordinator-approval gate and its REQUIRE_MATCH_APPROVAL flag have been removed. Fields major, career, interests and interestAnswer are proposed useful fields in lib/contracts.ts, not verified quotations from Melissa. Include in join/profile and searchable admin member views. Both roles set availability, timezone, meetingFormat; only overlap-compatible results appear, Jev considers these context alongside goals/expertise. Canonical interests include Learning AI, Networking and Finding a mentor. Jev categorization suggestions are editable; no automatic email subscription.

## Additions (v2, user-approved feature set)
- query directory.list → DirectoryEntry[] — authenticated opt-in professional directory. No emails, phone numbers, bios, private notes or availability slots; only public-safe profile fields of approved, discoverable members.
- query audit.list → AuditEvent[] — admin-only, newest-first view of the append-only staff audit log.
- Server-side audit events are recorded inside these mutations: membership approve/pause, match approve/decline, content save/publish, event create/update, import commit.
- Shared navigation additions: /portal/directory (member directory) and /admin/audit (staff audit log).
- Calendar sync: match detail offers the existing .ics download plus a Google Calendar template link built from the same meeting data (no server state changes).

## Match approval mode — gate removed (2026-11-21)
Per a direct user instruction, the coordinator/admin approval gate for mentorship matches has been removed. `REQUIRE_MATCH_APPROVAL` is no longer a configuration binding: mutual Interested decisions always create an `active` match. Staff retain dashboard controls to pause, decline or end matches. The `admin.approveMatch` procedure and the admin match-approval screen are intentionally left in place for legacy `awaiting-coordinator` records only. This supersedes the earlier approval-by-default and configurable-participant-led notes in this document.
