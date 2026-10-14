# AGENTS.md

Project context for Codex. Read this before making changes.

## Project

Whodunit is a web-based pixel art detective game. The player investigates a crime scene, interrogates AI-driven suspects through chat, confronts them with evidence, and accuses the culprit. The real culprit can be broken into confessing; innocent suspects also lie to hide their own secrets.

This is a game / work of fiction only. Never build features aimed at real-world interrogation or use with real people.

The developer is an experienced programmer but a beginner in ML, and wants to learn ML hands-on through this project. When touching ML code, explain the reasoning and concepts briefly, not just the code.

## Core design principle

**The LLM is the voice, not the brain.**

All case logic lives in a deterministic game-state engine. The LLM only turns engine decisions into in-character dialogue. Never let the LLM decide:

- who the culprit is or what really happened
- whether a statement contradicts evidence
- how much composure changes
- whether a suspect confesses, or to what
- what a suspect is allowed to reveal

If a feature seems to need the LLM to make one of these decisions, put the logic in `engine/` instead.

## The three layers

1. **Ground truth** (case file, read-only): culprit, motive, method, true timeline for every suspect, every suspect's secrets and the lies protecting them. Innocent suspects have secrets too (e.g. an affair), so everyone looks suspicious.
2. **Evidence graph**: evidence nodes linked to people, places, times and statements. Edge types: `supports`, `contradicts`, `implicates`, `reveals`. Small enough (dozens of nodes) to load fully into memory per session.
3. **Suspect state** (per suspect, per session):
   - `composure` 0-100
   - `questionsRemaining` (starts at 10)
   - `commitments`: statements the suspect has made and is now bound to
   - `confrontedEvidence`
   - `revealedSecrets`
   - confession conditions: only the culprit has a murder confession; innocents can only confess their own secrets

## Game rules

- Each suspect can be asked at most 10 questions per session.
- Asking a question costs 1. Presenting evidence costs 1.
- At 0 remaining, the suspect "lawyers up": interrogation for that suspect is locked.
- A successful contradiction (evidence with a `contradicts` edge against a statement the suspect committed to) lowers composure.
- Confession requires the suspect's specific confession conditions: low composure plus the required evidence having been confronted.
- Accusing the wrong suspect ends the case as "gone cold".
- Verdict rating rewards fewer total questions used (1 to 3 stars).
- The question counter is enforced on the server, never trusted from the client.

## Interrogation turn flow

1. Player sends a message, optionally with an evidence id.
2. Server checks `questionsRemaining > 0`, then decrements.
3. Classify intent: question, confrontation, accusation, smalltalk (`engine/intent.ts`, a rule-based stand-in for the ML classifier).
4. Engine (`engine/turn.ts`, `decideTurn`) decides everything that matters: which claims the suspect commits to, whether a lie is broken, how composure moves, whether a secret comes out.
5. Two kinds of reply follow from that decision:
   - Open turn (a question, small talk, an accusation, an exhibit that changes nothing): `promptBuilder` builds a prompt containing only what this suspect may say at this state, the model answers, and `guard` checks the answer. A rejected answer is retried (the model is told why), then replaced by one of the suspect's scripted `fallbackLines`.
   - Dictated turn (a lie breaks or a secret cracks): the admission is the case author's own written text (`claim.truth`, `secret.description`), word for word. The model only adds a short exclamation in front of it (`buildReactionPrompt`, checked by `checkReaction`). If the model fails, the admission goes out alone. A small model must never be left to paraphrase facts the engine has decided.
6. Save the turn plus a state snapshot to `transcripts`.

## Case files, the engine and the LLM

A case is one JSON file in `/cases`, validated by `caseFile/schema.ts` (zod) and then by `caseFile/validate.ts`, which enforces the case-writing rules and *plays every suspect through the real engine* to prove the case can be won. `pnpm db:seed` refuses any case that fails either check.

- Public half: briefing, suspect police files (including each suspect's `look`: skin, hair style and colour, facial hair, glasses, hat, outfit and its colour, chosen from the fixed `LOOK` vocabulary in `caseFile/schema.ts`, so the frontend can always draw them), and exhibits (each with one of 14 `sprite` names). Sent to the client.
- `truth` (server only): the story and timeline, and per suspect a `persona` (voice, temperament, background, `fallbackLines`), `trueWhereabouts`, `claims` and `secrets`, plus the evidence graph `edges`.
  - A **claim** is a stance the suspect takes once a player message contains one of its `triggers` (that is what binds them to it). `isLie` claims carry the `truth` (first person) they hide.
  - A **secret** (`kind: murder` for the culprit only, `personal` for anyone) cracks when composure is at or below `maxComposure` AND every exhibit with a `reveals` edge to it has been shown.
  - **Edges**: `contradicts` (disproves a lie, only counts once the suspect has committed to it), `implicates` (adds pressure, once per exhibit), `supports`, `reveals`.
  - `leakMarkers` are distinctive words from a lie's truth or a secret's text. The guard rejects any reply that says one before it is allowed to come out.
- Suspect state gained `brokenClaims`. `commitments`, `brokenClaims` and `revealedSecrets` hold claim and secret ids.

The guard (`llm/guard.ts`, pure) rejects: leaked markers (this suspect's and every other suspect's), an unprompted murder confession, a clock time nobody has mentioned, repeating a lie that was already exposed, replies outside English, replies that break character or think aloud.

Models run locally through Ollama behind `llm/provider.ts` (`LLM_PROVIDER=ollama|dummy`). Two tasks, two models: `chat` needs speed, `casegen` needs quality and runs rarely.

- Chat: use a NON-thinking model (`qwen3:4b-instruct-2507-q4_K_M`, about 1 s per reply on a 4 GB GPU). A thinking model (plain `qwen3:4b`) takes about 30 s per reply here and ignores `think: false`, leaking its reasoning into the reply.
- Case generation: `pnpm case:generate [-- --count 5 --save-db]` writes cases in a series. Each is numbered after the highest existing one (`Case 0002`, `0003`, ...), takes the next setting from a rotating list (`caseGen/catalog.ts`, 24 settings), and is told which suspect names are already taken. Other flags: `--theme "..."`, `--culprit id`, `--seed n`, `--out dir`, `--repairs n`. A case is written in three stages (cast, night, evidence) with the casegen model, checked by the same validator, and exact complaints go back to the stage at fault. A case that fails in a batch is reported and the next one is attempted. `--save-db` also saves each to the database; otherwise run `pnpm db:seed`. `pnpm case:validate [files]` checks case files without touching the database.
- Generating is a run-it-and-leave-it job. `qwen3.6` is 23 GB on a 24 GB machine: while it runs there is almost no free RAM, everything else (including the game and its chat model) slows to a crawl, and it can take well over 15 minutes per case. Do not play while a batch runs.
- Measured on this project's laptop (RTX 4050 4 GB, 24 GB RAM): `qwen3.6` wrote a valid, playable case in about 15 minutes with one repair round; the 4B instruct model cannot write a case that passes the rules (use it for chat only). The Ollama provider streams its replies on purpose: a non-streamed call sends no headers until generation ends, and Node's `fetch` aborts after 5 minutes of silence.
- Stage prompts ask for JSON through a JSON Schema, and the schema makes `truth`, `exposedNote` and `leakMarkers` required keys (empty for a true claim): a small or fast model skips optional keys even when it should fill them. A faulty stage is re-asked with the exact complaint AND its own previous answer, so it edits instead of rewriting.
- What a script can check is checked in the stage that caused it, not left to the model: a cast that reuses a name another case already has, a night where someone never lies, evidence that leaves a lie unexposable. A secret threshold that perfect play misses by a few points is fixed by arithmetic (`caseFile/balance.ts`: small slips only, with a ceiling so a killer cannot be balanced into a pushover) instead of costing another multi-minute model attempt.
- After a murder confession the suspect may not deny guilt (prompt directive plus a guard check).
- Known limits: the 4B chat model sometimes invents harmless details ("I have never been to Union Station"); the guard only catches invented clock times and known secrets. A suspect's look is drawn from a fixed vocabulary (5 skin tones, 7 hair styles, 6 hair colours, 4 kinds of facial hair, glasses, hat, 6 outfits in 8 colours), and an exhibit is one of 14 sprites: a new value in either needs drawing in `frontend/src/lib/pixel.ts` first. Suspects are fixed at three per case (the room scene seats three).

## Tech stack

- Frontend: React, React Router, Tailwind CSS v4, Vite, TypeScript
- Backend: Node.js, TypeScript, Express 5 (REST)
- Database: PostgreSQL with Prisma 7, connected through the `@prisma/adapter-pg` driver adapter (v7 requires an adapter). We moved off MongoDB because Prisma 7 has no MongoDB support (it only arrives with Prisma 8, still release-candidate). `backend/docker-compose.yml` runs Postgres locally
  - The connection URL for the CLI lives in `backend/prisma.config.ts` (not in `schema.prisma`); the app passes `DATABASE_URL` to the adapter in `src/db/prisma.ts`
  - The client is generated into `backend/src/generated/prisma` (gitignored; `pnpm install` and `pnpm build` regenerate it). Import it from there, never from `@prisma/client`
  - Schema changes go through `pnpm db:migrate` (migration files are committed)
- Validation: `zod` (planned: shared schemas in `packages/shared`)
- LLM: local Ollama (small non-thinking model for suspect chat, larger model for case generation) behind `llm/provider.ts`, so it can be swapped for a hosted or fine-tuned model
- ML (planned): separate Python FastAPI service, called from Node over HTTP
- Package manager: pnpm (frontend and backend are separate packages for now)

## Project structure

```
patrickjane.simulator/
├── frontend/                 # React + Tailwind (Vite)
│   └── src/
│       ├── pages/            # route pages: MainMenuPage (/), GamePage (/play), LoginPage (/login: sign in + register), ProfilePage (/profile: edit account, password, log out, delete), mock pages (Multiplayer, Settings)
│       ├── components/       # PixelScreen, PageFrame, Field, ConfirmModal, UserProfileCard, CasePicker (Case 1, 2, 3... cards with the suspects' faces), Portrait, FilesScene, RoomScene, InterviewConsole, SuspectDossier, ChatPanel, EvidencePanel, ...
│       ├── hooks/            # useAuth (AuthProvider: token in localStorage, restored via /api/auth/me, cleared on any 401), useGameBoot (loads the case list, resumes or starts a session), useInterrogation (game state; every counter, mood and reply comes from the API), usePixelViewport (full-window pixel scale), useElementSize
│       ├── data/             # quickQuestions.ts (generic quick-question buttons, they just send text), placeholderStats.ts: (DUMMY) rank / casesSolved, not tracked by the backend yet
│       ├── lib/              # api.ts (fetch client, ApiError, token storage, case/session/interrogate/accuse calls), pixel.ts (pixel-art renderer: three hand-drawn portraits, every other suspect drawn from their case's `look`; 14 exhibit sprites, an unknown name maps to the nearest by keyword), savedGame.ts (chat log + notes kept in localStorage so a reload resumes the session), rules.ts, theme.ts
│       └── types.ts
├── backend/                  # Node + Express REST API
│   ├── prisma/
│   │   ├── schema.prisma     # players, auth tokens, cases, sessions, suspect states, transcripts
│   │   ├── migrations/       # SQL migrations (prisma migrate)
│   │   └── seed.ts           # loads every case in /cases (validated by schema and rules)
│   ├── prisma.config.ts      # Prisma 7 CLI config: schema path, migrations path, DATABASE_URL
│   ├── scripts/              # generateCase.ts (pnpm case:generate), validateCases.ts (pnpm case:validate)
│   ├── docker-compose.yml    # local PostgreSQL
│   └── src/
│       ├── index.ts          # starts the server
│       ├── app.ts            # Express app, middleware, routers
│       ├── config/env.ts     # zod-validated environment variables
│       ├── db/               # prisma.ts (client + pg adapter), includes.ts (child rows read in display order)
│       ├── generated/prisma/ # generated Prisma client (gitignored)
│       ├── caseFile/         # schema.ts (zod case file), validate.ts (case-writing rules + play-through), load.ts, store.ts (save to DB)
│       ├── caseGen/          # stages.ts (prompts + JSON schemas), generate.ts (3-stage generator with repair loop), catalog.ts (next case number, rotating settings, names to avoid)
│       ├── engine/           # PURE game logic: no DB, no LLM, no I/O (+ *.test.ts): intent, turn (decideTurn), questions, verdict
│       ├── llm/              # provider.ts (interface), ollama.ts, index.ts (picks the provider), promptBuilder.ts, guard.ts, chat.ts (retry + fallback)
│       ├── routes/           # /api/auth, /api/cases, /api/players, /api/sessions (+ /:id/interrogate, /:id/accuse)
│       ├── services/         # glue between engine, llm, db; publicView.ts whitelists response fields
│       └── http/             # errors.ts (HttpError + error handler), auth.ts (requireAuth, requireOwner)
├── packages/shared/          # planned: zod schemas + inferred types used by web and server
├── services/ml/              # planned Python service: intent/, retrieval/, finetune/
└── cases/                    # case files as JSON, validated and seeded into the database
```

## REST API

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | | |
| GET | `/api/cases` | | case list in order (`Case 0001`, `0002`, ...), each with its briefing and its suspects' faces (`look`); never `truth` |
| GET | `/api/cases/:id` | | public case info, never `truth` |
| POST | `/api/auth/login` | `{ username, password }` | `{ token, expiresAt, player }`; 401 `INVALID_CREDENTIALS` for any failure; token lasts 7 days |
| POST | `/api/auth/logout` | | needs token; revokes it; 204 |
| GET | `/api/auth/me` | | needs token; own account including `email` |
| GET | `/api/players` | `?limit=50&offset=0` | public view only (`id`, `username`, `createdAt`), max 100 per page |
| POST | `/api/players` | `{ username, email, password }` | register; 201; 409 `USERNAME_TAKEN` / `EMAIL_TAKEN`; password 8-128 chars |
| GET | `/api/players/:id` | | public view only, never `email` |
| PATCH | `/api/players/:id` | `{ username?, email?, password?, currentPassword? }` | needs token, owner only (403 otherwise); `password` needs `currentPassword` and signs out the player's other logins |
| DELETE | `/api/players/:id` | | needs token, owner only; 204; tokens go with the account |
| POST | `/api/sessions` | `{ caseId }` | new play session |
| GET | `/api/sessions/:id` | | session + per-suspect state |
| POST | `/api/sessions/:id/interrogate` | `{ suspectId, message, evidenceId? }` | costs 1 question; 403 `LAWYERED_UP` at 0; `{ reply, kind, note?, lawyeredUp, closer?, suspect }` |
| POST | `/api/sessions/:id/accuse` | `{ suspectId }` | SOLVED or COLD + stars |

Protected routes take `Authorization: Bearer <token>`; missing, malformed, expired or revoked tokens answer 401 `UNAUTHENTICATED`. Game routes (`/api/sessions`) are not behind login yet.

## Database tables

All ids are UUIDs; routes reject anything else with 404 (`parseId`) before it reaches the database.

- `players`: player accounts (`username`, `email`, both stored lowercase and unique; `passwordHash` is scrypt, never leaves the server). Sessions are not linked to players yet.
- `auth_tokens`: login tokens. Only the SHA-256 of the token is stored (the raw token is shown once, at login); rows expire after 7 days and cascade-delete with the player.
- `cases`: the case file. Public info (`title`, `number`, `briefing`) plus ground truth columns (`culpritId`, `verdictCorrect`, `verdictWrong`, and `truth`: the JSON described under "Case files" above, re-validated with `truthSchema` on every read). Server-only, read-only. Its suspects (public police-file fields only, including `whereabouts`) and evidence are child rows in `case_suspects` and `case_evidence` (read back by `position`).
- `sessions`: player progress, discovered evidence, optimistic-concurrency `version`. Per-suspect state (composure, questions, `commitments`, `brokenClaims`, `confrontedEvidence`, `revealedSecrets`) is one row per suspect in `suspect_states`; updating a suspect and bumping `sessions.version` happen in one transaction.
- `transcripts`: append-only log of every turn with state snapshot. Also the future fine-tuning dataset, so keep it clean and structured: the snapshot is the engine's plain `SuspectState`, never a database row.

## Rules for writing code

- Server-authoritative. Ground truth, undiscovered evidence, culprit id and confession conditions must never be sent to the client. Check every API response for leaks.
- Engine functions are pure: `(state, action) => newState`. No side effects. Every engine function gets unit tests that run without any LLM call.
- Define data shapes once in `packages/shared` with zod; infer TypeScript types from them. Do not duplicate types in web or server.
- Validate case files against the shared schema AND `validateCaseFile` on seed (done today with the backend-local schema in `caseFile/schema.ts`; it moves to `packages/shared` later).
- The model is the voice, never the brain: facts a suspect admits or confesses come from the case file, not from model output.
- All LLM access goes through `llm/provider.ts`. Never call an LLM SDK directly elsewhere.
- Keep secrets in `.env`; never commit keys.
- Use TypeScript strict mode.

## Case-writing rules

1. Every suspect lies about something.
2. The culprit is provable through a chain of evidence that points to them and only them.
3. No dead ends: every innocent lie can be exposed and explained by evidence in the case.

## Visual design (pixel art)

- Retro 16-bit inspired pixel art, 1940s noir mood.
- Base canvas 360x225, scaled 4x to 1440x900. Everything aligns to the 4x grid.
- Every page is fullscreen and fluid via `PixelScreen`: laid out in logical pixels at any aspect ratio, magnified by a whole number (`usePixelViewport`) so it fills the window. Menus count on at least 240x168 logical px, gameplay on 400x225. Switch layouts with `usePixelScreen().wide` (columns vs tabs), not CSS breakpoints: the stage is scaled, so viewport media queries don't match its logical size.
- Gameplay has two scenes (header tabs): FILES (suspect police files with personal details and stated whereabouts, exhibit locker, case notes) and ROOM (the three suspects seated behind the table; click one to pop up their interview panel: file, chat, exhibits). `Suspect` fields are public police-file data only; never put ground truth there.
- No anti-aliasing, gradients, blur or soft shadows. Dithering for shading. 1px dark outlines.
- Apply `image-rendering: pixelated` to all images and canvases.
- Pixel bitmap fonts only, minimum 16px on screen; chat text uses a typewriter reveal.
- Portraits 64x64 (shown 256x256) with CALM / NERVOUS / BREAKING variants.
- Palette:
  - Shadows `#0F1220` `#1B2033` `#2C3350`
  - Paper `#E6D5AE` `#C4A97A` `#8A6E4B`
  - Amber accent `#F2B33D` `#C27C1E`
  - Crimson (contradiction/danger) `#C8323C` `#7A1E2A`
  - Teal (truth/success) `#4FA3A0` `#2D6466`
  - Text `#1A1414` / `#F4ECD8`
- Key UI: composure meter as 10 segmented blocks; question counter as 10 amber pips ("QUESTIONS 7/10"), blinking crimson at 3 or fewer; stamps for CONTRADICTION!, CASE CLOSED, CASE GONE COLD, LAWYERED UP, NEW EVIDENCE.
- Define the palette as Tailwind theme tokens; do not hardcode hex values in components.

## ML roadmap (learning path)

Each stage sits behind the same interface as its API counterpart so it can be swapped in independently:

1. Intent classifier for player messages (question / confrontation / accusation / small talk)
2. Embedding-based retrieval of relevant evidence and statements
3. NLI-based contradiction detection
4. Fine-tune a small open model on `transcripts` to replace the hosted LLM

## Current status

Early development. Suggested build order:

1. Case schema in `packages/shared` + one sample case in `cases/`
2. Engine with unit tests (including question limit)
3. `/interrogate` endpoint with hosted LLM, prompt builder and guard
4. Interrogation Room UI
5. First complete playable case, then accusation/verdict
