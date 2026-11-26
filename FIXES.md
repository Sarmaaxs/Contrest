# Fix notes — Contrest

## Changes
- Group creation now uses a dedicated atomic `create_group_conversation(uuid[])` RPC instead of calling the one-to-one `start_dm` RPC. This prevents a group-creation action from reusing an existing DM.
- `add_group_members` retains its server-side membership authorization, enforces a 50-member cap, and serializes the cap check against concurrent invites.
- Nuvessia rate limits are stored in Postgres per authenticated user instead of a per-edge-instance in-memory Map. The endpoint also rejects malformed or oversized JSON bodies.

## Required Supabase deployment
1. Review the new migration at `supabase/migrations/20261126120000_secure_group_creation_and_nuvessia_limits.sql`.
2. Apply it to the intended Supabase project (`supabase db push` after selecting the correct project).
3. Deploy the updated Edge Function (`supabase functions deploy nuvessia-chat`).
4. Confirm the `GROQ_API_KEY` Edge Function secret is configured. The migration is included in this archive; it has **not** been applied to the remote database by this packaging step.

## Verification
- `npm run build`: passed.
- `npm run typecheck`: passed.
- Existing large-bundle warning remains; it does not fail the build.
