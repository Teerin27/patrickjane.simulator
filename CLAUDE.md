# CLAUDE.md

Project context for Claude Code. Read this before making changes.

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
3. Classify intent: question, confrontation, accusation.
4. Engine checks contradictions and updates suspect state.
5. `promptBuilder` builds a prompt containing only what this suspect may reveal at this state.
6. LLM generates the reply.
7. `guard` rejects replies that leak ground truth beyond the suspect's permissions.
8. Save the turn plus a state snapshot to `transcripts`.

## Tech stack

- Frontend: React, Tailwind CSS, Vite, TypeScript
- Backend: Node.js, TypeScript, Express or Fastify
- Database: MongoDB with Mongoose
- Shared types: `zod` schemas in `packages/shared`
- LLM: hosted API for now, behind a provider interface so it can be swapped for a self-hosted model
- ML (planned): separate Python FastAPI service, called from Node over HTTP
- Monorepo: pnpm workspaces

## Project structure

```
whodunit/
├── apps/
│   ├── web/                  # React + Tailwind
│   │   └── src/
│   │       ├── pages/        # CaseSelect, Investigation, Interrogation, EvidenceBoard, Verdict
│   │       ├── components/   # ChatPanel, EvidenceTray, ComposureMeter, QuestionCounter, SuspectCard
│   │       ├── hooks/
│   │       └── api/
│   └── server/
│       └── src/
│           ├── engine/       # PURE game logic: no DB, no LLM, no I/O
│           │   ├── composure.ts
│           │   ├── contradiction.ts
│           │   ├── confession.ts
│           │   ├── questions.ts
│           │   └── knowledge.ts
│           ├── llm/
│           │   ├── provider.ts
│           │   ├── promptBuilder.ts
│           │   └── guard.ts
│           ├── routes/       # /cases, /sessions, /interrogate, /accuse
│           ├── models/       # Mongoose schemas
│           └── services/     # glue between engine, llm, db
├── packages/
│   └── shared/               # zod schemas + inferred types used by web and server
├── services/
│   └── ml/                   # planned Python service: intent/, retrieval/, finetune/
└── cases/                    # case files as JSON, seeded into MongoDB
```

## MongoDB collections

- `cases`: ground truth + evidence graph. Server-only, read-only.
- `sessions`: player progress, discovered evidence, per-suspect state.
- `transcripts`: append-only log of every turn with state snapshot. Also the future fine-tuning dataset, so keep it clean and structured.

## Rules for writing code

- Server-authoritative. Ground truth, undiscovered evidence, culprit id and confession conditions must never be sent to the client. Check every API response for leaks.
- Engine functions are pure: `(state, action) => newState`. No side effects. Every engine function gets unit tests that run without any LLM call.
- Define data shapes once in `packages/shared` with zod; infer TypeScript types from them. Do not duplicate types in web or server.
- Validate case files against the shared schema on seed.
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
