---
name: "next-role-role-fit"
description: "How to score Role Fit on a Next Role board: the user's CV evidence against the job ad's requirements, each met/partial/gap with evidence, giving a % and band. Used by next-role-shortlist, next-role-daily-check and next-role-interview-prep, or \"score the fit for #N\"."
---

# Role Fit — CV against the job ad

Role Fit is the number on every role card ("High · 82%") and the Role Fit tab the user edits after
interviews. **It measures one thing: how well the user's CV evidence covers what the ad asks for.** Warm
routes, level, culture and appetite are not in it. Shot (the user's chance) and Fun are the user's, scored
by hand. Fit feeds Shot; it never sets it, and nothing is ever rejected on fit.

## Where everything lives

**The board is the source of truth.** Read and write it with the artifact database tool (`ArtifactData`).
The board's URL comes from the scheduled task's prompt, the calling skill, or the project's instructions;
if none gives one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use) | `profile/brief` — read it first; it binds every write |
| Skills evidence | `profile/skills` |
| Base CV text | `templates/cv`, field `text` |
| Career, stories, numbers, what the CV leaves out; things the user doesn't have (`gaps`) | `profile/me` |
| Limits (requirement counts, weights, band cut-offs) | `profile/settings`; a missing value means use the default below |
| CV text extraction tool | `refs/redline` |
| Roles, meetings | `roles`, `conversations` |

**Empty board.** If there is no role to score (none named, none passed by the calling skill, or the role
has neither an ad nor a listing to read), say so in one line and stop.

## Inputs

- **The ad.** The full posting text (`pasted` on the role, or the employer's page) for a proper score;
  only the listing (title, location, salary, the role row's summary or alert snippet) for a rough one.
- **`profile/skills`** — the user's top skills, each with a level and one line of CV evidence. The first
  place to look for evidence.
- **The base CV text** — `templates/cv`, field `text` (Markdown of the whole CV: every role, its scope and
  numbers). The second place to look: the skills list is a short summary and misses most of the detail.
  If `text` is missing, decode `b64` and extract it (`redline.py text` from `refs/redline`), and say in the
  report that the board has no text for the CV.
- **`profile/me`** — career, stories and numbers, and what the CV doesn't say (skills left off, fuller
  stories, watch-outs). The third place to look.
- **Never invent evidence.** No evidence in those three means `gap`, however likely it seems. Anything
  listed in `profile/me` `gaps` (things the user doesn't have) is always `gap`, never `partial`; its `note`
  is the evidence line.

## Method

1. Pull **real requirements** from the ad: `profile/settings` `fit.reqsProper` (default 5 to 8) for a
   proper score, `fit.reqsRough` (default 3 to 5) for a rough one. Skip boilerplate ("great communicator",
   "passion for…"). Merge duplicates. Keep each under about 10 words, in the ad's own vocabulary.
2. Mark each `must: true` when the ad says required / must / essential, or it is plainly the core of the
   job; otherwise `must: false`.
3. Match each: `met` (clear evidence), `partial` (adjacent or smaller-scale evidence), `gap` (none).
   `evidence`: the one line that justifies it (from `profile/skills`, the CV text or `profile/me`), or why
   it is a gap, under about 12 words. Check all three, in that order, before marking anything `gap` or
   `partial`.
4. Score: weight must 2, nice 1 (`fit.weights`); met 1, partial 0.5, gap 0; `na` (not needed) is left out.
   `pct = round(100 × weighted met / total weight)`.
5. Band from `profile/settings` `fit.bands` (the lowest % for each band; default Perfect 90+, High 75–89,
   Good 60–74, Stretch 40–59, Low under 40).

## What to write on the role

Merge into the role with `update` (pinned `if_version`), field `fit` only:

```json
"fit": {
  "pct": 82, "band": "High",
  "rough": false,
  "basis": "posting",
  "at": "YYYY-MM-DD",
  "reqs": [
    {"text": "<requirement, in the ad's words>", "must": true, "match": "met",
     "evidence": "<one line from the user's evidence>", "src": "ad"}
  ]
}
```

- **Rough** (listing only): `rough: true`, `basis: "snippet"`. The card shows it as "~High · 70%". Use it
  for Longlist roles.
- **Proper** (full ad read): `rough: false`, `basis: "posting"`.
- **When a proper score replaces a rough one**, overwrite `reqs` and clear `rough`.

## The user's edits win

If `fit.basis` is `"edited"` or `"interview"`, or any requirement has `byYou: true` or `src: "interview"`,
**do not overwrite `reqs`**. The user has said what matters. Put any change you think is needed in
`fit.suggest` instead (below), and say so in the report.

## Suggestions from meetings (next-role-interview-prep)

After a conversation or interview is logged against the role, read its notes and propose changes as
`fit.suggest` — never edit `reqs` directly:

```json
"suggest": [{"text": "<requirement>", "must": false, "match": "na",
             "why": "<meeting> <date>: <what was said>", "at": "YYYY-MM-DD"}]
```

- `text` equal to an existing requirement changes that one; new text adds a requirement.
- `match` can be `met`, `partial`, `gap` or `na` (doesn't matter).
- Only what the notes actually say. One suggestion per point, `why` naming the meeting and date.
- The Role Fit tab shows them with Accept / Dismiss. Don't repeat a suggestion the user dismissed (it is
  gone from `suggest` but the meeting note is unchanged — check `at` against the note's date).

## Report

One line per role scored: `#N title — Band · pct% (rough|from the ad)`, plus the biggest must-have gap.

## Related

- `next-role-shortlist` — writes a proper Role Fit on every Shortlist role.
- `next-role-daily-check` — runs `role-fit` jobs from the fix queue.
- `next-role-interview-prep` — adds `fit.suggest` from meeting notes.
- `next-role-sweep` — writes a rough Role Fit on every Longlist role.