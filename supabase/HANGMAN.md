# Wisielec

Independent cooperative game for 1–12 guests. Random words use the existing `public.words` pool without changing it. A host may supply a custom word with at least two players; its author cannot guess. Polish letters are distinct, spaces and hyphens are visible, and seven incorrect unique letters end the round.

Install `hangman.sql` once on the configured Supabase project before releasing the frontend. The separate `hangman_private` schema is not exposed through the Data API. Its tables have RLS and no client grants. The public `hg_action` invoker delegates to a narrowly scoped private function that validates the per-tab guest bearer token, room membership, host rights, and round number. Responses never expose tokens or the word before the outcome. No Supabase Auth account is required, matching the existing games.

Room mutations lock the room row. Concurrent guesses merge, duplicate letters are free, and stale-round requests are rejected. The client polls every 1.2 seconds without overlapping polling requests, accepts only current revisions, restores sessions from sessionStorage, and retries failed synchronization. Invitation links open the join screen. Leaving explicitly transfers hosting and removes an empty room; closing a tab preserves its session for reconnection.

Validation: run `npm ci` and `npm run build`. Run `hangman.test.sql` against the installed schema to verify guest permissions, masking, Polish letters, duplicates, win/loss, rematch, reset, random selection, hosting transfer, and cleanup. Test data rolls back. CZÓŁKO and IMPOSTOR retain their existing components and database routines.
