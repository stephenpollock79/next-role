---
name: "next-role-interview-prep"
description: "Interview prep for Next Role board roles: screen prep, round prep, interview-process research, digests of the company's own interview materials, and one-page cheat sheets on request. Prepares; never decides. Run by a scheduled task, or \"prep the interview for #N\" / \"cheat sheet for #N\" / \"summarise this interview material for #N\"."
---

# Interview prep

Prep lives **on the meeting**: each interview is a role meeting (a `commitments` document), `state:
"unplanned"` until it is booked. See "Meetings and tasks" in `profile/brief`.

Two passes, same skill:

- **Screen prep** — when a role reaches `applied` (or `offer`) and its recruiter-screen meeting has no
  `prep`. Light and fast, because a recruiter can call within a day. Most of it is the same for every
  role; the tailoring is in why-this-role, why-this-company and the traps specific to this employer.
- **Round prep** — for the **next round**, as soon as it is known. Known means either an interview
  meeting for the role (any state, including `unplanned`), **or** the process is known — from the user's
  conversation notes (e.g. the stages a recruiter described), the company's own materials, or
  `interviewIntel.stages` — and the screen has happened. Do not wait for a booking: the rounds are
  usually described at the screen, days before a date is set. **Build only the next round.** The rest of
  the process stays as a list in `interviewIntel.stages`, not as meetings: processes change, and prep for a
  later round is better built after the user's notes from the one before it.

Skip screen prep when the screen has already happened (a done screening commitment, or a conversation
logged as a recruiter screen) — go straight to round prep.

**Rebuild when new material arrives.** A meeting whose `prep.builtAt` is older than the `addedAt` of any
material that applies to it (company, role or that meeting), or older than the role's `final.cv.at` or
`final.letter.at`, gets its prep rebuilt, and so does the role's `interviewGeneral`. The same goes for a
material whose `digest` you have just written for the first time.

**Cheat sheets are built only on request** ("cheat sheet for #N", step 4d), never on a scheduled run or
as part of building prep: the user may still add prep or materials, and a sheet built early goes stale.
Each request builds it fresh from the board as it stands then.

**It prepares; it does not decide.** Never change `stage`, `flowStatus` or scores. On commitments it
writes only `prep`, and it may **create** an `unplanned` interview meeting for the next round when it is
known but not yet on the board, always with `expected: true` (a round nobody has offered yet: the board shows it
on the role's Interviews tab as "Expected, not offered" and keeps it out of Week ahead's Pending). It never
books, moves, completes or deletes a meeting, never clears `expected`, and never creates a meeting for a role
that has ended (`stage` closed, g1_rejected or g2_rejected).

## Where everything lives

**The board is the source of truth; everything comes from it.** Read and write it with the artifact
database tool (`ArtifactData`). The board's URL comes from the scheduled task's prompt or the project's
instructions; if neither gives one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use, meetings and tasks) | `profile/brief` — read it first; it binds every write |
| Who the user is: facts, stories with numbers, standard answers, watch-outs, what they don't have (`gaps`) | `profile/me` |
| Skills evidence; base CV text | `profile/skills`; `templates/cv` field `text` |
| Limits (interview research freshness, material text sizes) | `profile/settings`; a missing value means use the default below |
| What the user sent; the pack draft | `finals/<roleId>`; `packs/<roleId>` |
| Roles, companies, sectors, meetings, conversations, materials | `roles`, `companies`, `sectors`, `commitments`, `conversations`, `materials` |
| Mock interviews and their feedback | `mocks` (one doc per mock: `roleId`, `type`/`types`, `date`, `feedback`) |
| Baseline screen prep (optional); .docx text tool | `refs/screen-prep-baseline` (field `md`), when the board has one; `refs/redline` |

Name a rule the way the board does (its name with its id), never a bare id.

**Empty board.** If no role at `applied` or `offer` needs screen or round prep, no applicable material
lacks a `digest`, and no prep is stale or missing a starred question, stop. On a scheduled run that means
no report and no notification; in chat, say so in one line.

## What it must not do

1. **Never invent experience.** The user's facts are in `profile/me`. A story, number or claim not in
   that document, in the base CV, in the CV or letter the user sent (`finals`), or in a note the user
   wrote must not appear. Never suggest implying anything in `profile/me` `gaps` (things the user doesn't
   have).
2. **Never present online reports as fact.** Interview-process reports from review sites, forums or blogs
   are anecdotes: say "candidates report", give the source and the date, and prefer recent over old.
3. **Never delete a material or its file.** The user removes them on the board.
4. **Never write `finals/*` or the role's `final`.** They are the user's uploads; read only.

## 1. Read the inputs

Read `profile/brief` first, then:
- `profile/me` — facts, stories with numbers, standard answers, watch-outs, and `gaps`. When the role asks
  for something in `gaps`, give it a line in `avoid` or `focus` on how to answer honestly.
- **The base CV text** — `templates/cv`, field `text`: the whole CV as Markdown. Even when prep runs from
  the sent CV, use it to find a stronger true example for a likely question (the sent CV is tailored and
  cut down). Anything raised from it must also be defensible against what the interviewer has read.
- `profile/skills` — the user's top skills, each with one line of CV evidence. Use it to pick which skill
  and story answers each likely question.
- **What the user sent them** — `finals/<roleId>`: `cv` and `letter`, each {name, mime, size, sha256, at}
  plus either `assetId` or, on older uploads, `b64`; Word or PDF. **`assetId`** (uploads since 5 Oct): the
  file is in the board's file store, not the record; fetch it with the Artifact tool — `action: "read"`,
  the board `url`, `path: "<assetId>"` (one id per call; `paths` does not fetch assets) — which saves it
  locally. **`b64`**: decode it. Either way check the sha256, and extract the text (`redline.py text` from `refs/redline`
  for .docx, `pdftotext` or reading the PDF for PDFs). **This is what the interviewer has in front of
  them:** prep from it, not from the pack draft. Every line in it is fair game for a question, so `focus`
  and `stories` lead with what it claims, and `avoid` flags anything in it the user would struggle to back
  up. The letter's argument should run through `tellMe` and `whyRole`. If there is no `final` on the role,
  fall back to `packs/<roleId>` and say in the report that prep used the draft, not what was sent. If there
  is no pack either, use the base CV text and say so.
  Read it again when the role's `final.*.at` is later than a meeting's `prep.builtAt`, and rebuild that prep.
- The role's `fit` — the ad's requirements and how the user matches. Lead prep with the must-have
  **gaps**: each gets a line in `avoid` or `focus` on how to handle it honestly.
- The role's `adSummary` — the job ad, summarised when the role reached To apply: why the role exists,
  scope, product, responsibilities, success measures, stated process. Use it for `whyRole`, `tests` and
  `likelyQuestions`, and prefer it to re-reading the posting, which may have come down. No `adSummary`:
  read the posting at `url` if it is still up.
- The role row — `enrich` (summary, openQuestions), `qStar`, `qAnswers`, `red`, `green`, `g2Note`,
  `referral`, `interviewGeneral`.
- The company row — `ai`, `culture`, `ladder`, `questions`, `qStar`, `qAnswers`, `red`, `interviewIntel`.
- **`materials`** for the role — see 1b. **The company's own materials outrank every other source except
  the user's conversation notes**: they are the employer saying how it interviews.
- `conversations` for the role and the company — what the user liked, what concerned them, and their
  `nextQuestions`. **These outrank everything else**: a real screen tells you more than any website.
- `sectors` for the company's sector — `cvAngle`, `gaps`, `questions`, `qStar`.
- `commitments` for the role (`roleId` = the role, or the role in `tagRoles`) — every interview meeting,
  its `type`, `state`, date, people, `detail`, and any `prep` already written.
- The **baseline**, when the board has one: `refs/screen-prep-baseline` (field `md`), a worked example of
  a good screen prep (story arc, watch-outs, salary approach, logistics, questions). Reuse its structure
  and its role-independent answers; replace everything specific to the employer it was written for.
  Without one, work from the screen prep format in step 3 and `profile/me` alone.
- Any prep already on the meetings (`prep`) and the role's `notes` — build on it, never contradict it
  silently.
- **The latest mock** for the role and this round's type — the `mocks` doc with `roleId` = the role and
  `type` (or a `types` entry) matching the prep's mock type, newest `date`. Only the latest; older mocks
  are ignored. Short-form feedback (`feedback.v` = 2) gives `headline`, `keep`, `improve`, `nextFocus` and
  `perAnswer` items rated fix or average (their `change` lines); older feedback gives `missed` (question + the
  example the user could have used), `improve`, `watchOuts` and `nextFocus`. These feed the cheat sheet (4d). No mock: the sheet uses traps
  only.

## 1b. The company's interview materials

The user adds what a company sends — a candidate prep guide, a case brief, a link to their "how we
interview" page — on the role's Interviews tab (in its Prep group) or the company card. Each is one doc in
the `materials` collection:

```
title, kind: "link" | "text" | "file", note, addedAt,
scopeKind: "company" | "role" | "meeting",   // every role at the company / all of this role's interviews / one meeting
companyId, roleId, meetingId,
url,                                            // kind link
text,                                           // kind text (up to the board's text limit)
file: {id, name, size, type},                   // kind file — an asset in the board's file store:
                                                //   PDF, image, Markdown or plain text
converted: {from, name, size},                  // set by the board when it turned a Word file into Markdown
textFrom: "extracted",                          // set by this skill when `text` is its extraction of `file`
digest: {builtAt, format, assesses[], questions[], points[]}   // written by this skill
```

A role's materials are those with `roleId` = the role (scope role or meeting) plus those with
`scopeKind: "company"` and `companyId` = the role's company.

**Read every material that has no `digest`:**
- `link` — fetch the page. If it cannot be read (login, blocked), leave `digest` empty and say so in the
  report.
- `text` — read `text`.
- `file` with `text` already filled (a `textFrom: "extracted"` copy) — read `text`; do not fetch the file.
- `file` — read it from the board's file store with the Artifact tool: `action: "read"`, the board's
  `url`, `path` = `file.id`. It is saved locally. Markdown or plain text (including a Word file the board
  converted — `converted` is set) is read as text. A PDF or image is read from there; if the read fails,
  leave `digest` empty and say so.

**Keep a text copy of every PDF or image file you read.** In the same update as `digest`, write `text`
= a faithful plain-text extraction of the file (headings and lists kept, no commentary), cut at
`profile/settings` `materials.maxTextChars` (default 20,000) characters with "[… cut at <n> characters]"
at the end when longer, and `textFrom: "extracted"`. Later rebuilds read `text` instead of re-fetching the
file. Never overwrite a `text` that has no `textFrom` — that is the user's own. Skip the copy for Markdown
and text files: the file already is one.

Then write `digest` on the material (update, pinned `if_version`) — this is what the board shows under
"What Claude took from it" and what the Mock interview tab feeds the interviewer:

```json
"digest": {
  "builtAt": "YYYY-MM-DD",
  "format": "One line: length, who, what kind of round(s).",
  "assesses": ["What they say they assess — their criteria, in their words"],
  "questions": ["Questions, tasks or case prompts they name"],
  "points": ["Anything else the user must know: logistics, what to bring, what they value, what to avoid"]
}
```

Up to `profile/settings` `materials.digestItems` (default 8) items per list, each within `profile/brief`'s
Keep it short length. Only what the material says — never pad it with general advice. A meeting-scoped
material applies to that meeting's prep only; company and role materials apply to every round and to
`interviewGeneral`.

When materials describe the process (stages, formats), they replace web reports in
`interviewIntel.stages` — mark those stages "(from their guide)". Any named question goes into the
matching round's `likelyQuestions` first; their assessment criteria shape `tests` and `focus`.

### "Summarise this interview material for #N" (in chat)

The board converts Word files to Markdown itself. It refuses files over its size limit, PowerPoint files
(it suggests saving as PDF) and text over its text limit; any of these can come to Claude instead. When
the user attaches one in chat:
1. Read it in full.
2. Ask in one line what it applies to if the user hasn't said: every role at the company, all of #N's
   interviews, or one meeting.
3. Write a new `materials` doc: `kind: "text"`, `title` ("<Company> — <what it is>"), `text` = a faithful
   short version (under `profile/settings` `materials.summaryChars`, default 3,000 characters: format,
   criteria, named questions or tasks, logistics), `note: "Summarised by Claude from <file name>, <date>"`,
   the scope fields, `addedAt` today, and its `digest` straight away. Id: slugified title + "-" + 5 random
   base-36 characters.
4. Then offer to rebuild the prep for the affected meetings now.

## 1c. Starred questions — must ask

Interviews rarely leave time for every question, so the user stars the ones they must ask. Each doc that
holds questions keeps a `qStar` list of the starred question texts:
- the **role** — for its own `enrich.openQuestions` and for the `nextQuestions` in its conversations;
- the **company** — for `company.questions` (a star there applies to every role at the company);
- the **sector** — for `sector.questions`.

Match a star to a question by text, ignoring case and extra spaces. A question is **open** unless it has
an answer in `qAnswers` (on the role for role questions; on the company for company and sector questions).

Every `askThem` — screen, round, and `interviewGeneral.askThem` — follows this order:
1. **Every starred open question, first**, in the order they appear on the board. Never drop one to make
   room, and never reword it beyond trimming to the length rule.
2. Then the most important unstarred open questions, filling up to the list's usual size.
3. Never include a question that is already answered.

If starred questions alone exceed the usual size, list them all and nothing else. When a meeting's
existing `askThem` is missing a starred open question, or still lists an answered one, rewrite that
meeting's `askThem` (just that field) on the next run, even if the rest of the prep is current.

`qStar` is the user's: read it, never write it.

## 2. Research the company's interview process (once per company)

If the company row has no `interviewIntel`, or it is older than `profile/settings`
`research.interviewIntelFreshDays` (default 60), research it:
- search for "<company> <the role's title> interview", "<company> interview process", interview reviews
  for roles like this one (the user's `profile/me` `profession`, at the role's level) on the sites in
  `profile/settings` `research.interviewSources` (default: review sites and forums), and the posting's own
  description of the process;
- record the **stages** (e.g. recruiter screen → hiring manager → case → panel → values), how long it
  takes, anything unusual (take-home, whiteboard, presentation), and **reported questions**;
- note how old each source is.

Write it to the company row as:

```json
"interviewIntel": {
  "researchedAt": "YYYY-MM-DD",
  "stages": ["Recruiter screen (30 min)", "..."],
  "notes": "What is distinctive about how they interview — one short paragraph.",
  "reported": [{"q": "question as reported", "stage": "screen|hm|case|panel|values", "source": "<site>, <year>"}],
  "sources": ["https://..."]
}
```

The user's own conversation notes about the process (e.g. the stages a recruiter described) go in
`stages` first and are marked "(from the screen)". They beat any website, and so do the company's own
materials (1b).

## 3. Screen prep → `prep` on the recruiter-screen meeting

Find the role's meeting with `type: "screen"`. If there is none, create one first (see 4a). Write:

```json
"prep": {
  "kind": "screen",
  "builtAt": "YYYY-MM-DD",
  "tellMe": "The 60-90 second story, ending on why this role. Built from profile.answers.tellMeAboutYourself.",
  "whyRole": ["3-4 bullets from the ad summary (or the posting) and the shortlist research"],
  "whyCompany": ["3-4 bullets, each traceable to the company row or a source"],
  "proofPoint": "The one story from profile.stories that best fits this role, with its numbers.",
  "likelyQuestions": ["6-10 questions this screen will probably ask, incl. the standard career-story questions in profile/me and the baseline, salary, logistics"],
  "avoid": ["Traps: profile.watchOuts and profile.gaps that apply, plus employer-specific ones (a premise to correct, a word to avoid, a claim not to make)"],
  "askThem": ["4-6 questions: every starred open question first (1c), then the most important others from enrich.openQuestions, company.questions and sector.questions"],
  "salary": "The approach from profile.answers.salaryApproach, plus the band evidence on the role or company row if any.",
  "logistics": "From profile.answers.logistics, plus anything role-specific (office days, travel) still open."
}
```

Keep every bullet to one line. This is read in the ten minutes before a call.

## 4. Round prep → `prep` on each interview meeting

One meeting per round. Work out the meeting `type` from the conversation notes, the company's materials,
the meeting's own title and detail, and `interviewIntel.stages`, using the board's role-meeting types:
`screen`, `hm` (hiring manager), `domain`, `sense` (product sense / design), `competency`, `culture`,
`panel`, `livecase`, `casepres` (case study presentation), `exec`, `test`, `ref`. A take-home is two
things: a **task** (`item: "task"`, `type: "takehome"`, for the role, no date) and a **`casepres`
meeting** where it is presented; the prep goes on the meeting.

Inside `prep`, `type` is the **mock interview type** — exactly one of the Mock tab's six:
`screen`, `culture`, `pm`, `domain`, `livecase`, `takehome`. `pm` is the craft round for the user's own profession
(`profile/me` `profession`); the key stays `pm` whatever the profession.

```json
"prep": {
  "kind": "round",
  "builtAt": "YYYY-MM-DD",
  "type": "pm",
  "tests": "What this round is really testing, in two sentences.",
  "focus": ["What to lead with, each tied to a story in profile.stories"],
  "stories": ["Story title - the one-line version to tell, with its numbers"],
  "avoid": ["Traps for this round specifically"],
  "likelyQuestions": ["8-12, the company's own named questions first, then reported ones for this company and stage, then ones the role implies"],
  "askThem": ["Starred open questions first (1c), then questions for this interviewer, including anything the last round left open"],
  "mock": {"type": "pm", "focus": "Pre-filled focus notes for the Mock interview tab, e.g. 'probe experimentation design and metrics; ask about <an open topic from the role>'"}
}
```

The round's name is the meeting's `title` (e.g. "<Company> — Round 1: PM and domain interview") — there
is no `round` field. Which round is next is worked out by the board from the dates and the order (`order`
on undated meetings), so there is no `next` flag either.

The `mock` block is what the board's Mock interview tab pre-fills when the user presses Practise. For
`livecase` and `takehome`, `focus` must include the likely case prompt shape (e.g. "design or improve
<a mechanic central to the company's product>") — the company's own case brief, when a material gives
one — so the mock can set a realistic case. The Mock tab also passes the materials' digests to the
interviewer itself, so `focus` need not repeat them.

## 4a. Creating interview meetings, status, and cross-stage advice

The role card's **Interviews** tab lists the role's interview meetings, then other meetings for the role,
then tasks, then a collapsed **Prep** group holding the materials and the advice across the process.
Write it so that tab is complete:
- **Only the next round is a meeting.** The next round is the first stage in `interviewIntel.stages` after
  the last round that is done (or whose date has passed). When it is known but not on the board, create
  it; never create a meeting for a round beyond it. A take-home task and its `casepres` meeting are created
  only when that is the next round. Once the user logs a round as done, the following stage becomes the
  next round on the next run. If later rounds already exist as unplanned meetings with no date, leave them
  (the user may have added them) but build `prep` for the next round only. Create it with an id like
  `<roleId>-r<n>-<slug>`:
  `{item:"meeting", type, title:"<Company> — Round <n>: <name>", forKind:"role", forId:<roleId>,
  roleId:<roleId>, state:"unplanned", expected:true, date:"", time:"", duration:<minutes or "">, personIds:[],
  person:"", relationship:"", tagRoles:[], org:<company name>, detail:"", kind:"external",
  createdAt:<today>, order:<n>, prep:{...}}`. Never create a second meeting of the same `type` for the
  role when an unplanned one exists — write its `prep` instead.
- **Status comes from the meeting's `state`** — unplanned with `expected` → Expected, not offered; unplanned →
  Not planned; booked → Booked; done → Done. A take-home task you create also carries `expected: true`.
  Never set the state or clear `expected`; the user books meetings on the board, or in chat with `next-role-meetings`.
- **Cross-stage advice → `interviewGeneral`** on the role:
  `{themes[], stories[], avoid[], askThem[], notes}` - the things to land in every round, drawn from
  the role, the company, its materials and the user's conversation notes. Write it the first time round
  prep is built — or the first time a company or role material is read — and refresh it when a new
  conversation or material changes the picture.

## 4b. Questions for the mock interviewer

Question material comes from the company's materials (their `digest.questions`),
`interviewIntel.reported` (sourced, dated), the round's `likelyQuestions`, and the interviewer's own
knowledge of the round type. Never copy from a third-party question bank whose owner blocks copying or
download; respect that rather than work around it.

## 4c. Role Fit suggestions after a meeting

When a conversation or interview has been logged on the role since the last prep, follow the
`next-role-role-fit` skill's **Suggestions from meetings**: propose changes to the requirement list as
`fit.suggest` — what they said matters, what they said doesn't, anything new they asked for. Never edit
`fit.reqs`; the user accepts or dismisses them on the Role Fit tab. A material that lists what they assess
can prompt suggestions the same way.

## 4d. Cheat sheet → `prep.sheet` on the same meeting (on request only)

Run this step only when the user asks ("cheat sheet for #N", or for a named meeting). Which meeting: the one
named, else the role's next round. If that meeting has no `prep` yet, build the prep first (step 3 or 4),
then the sheet. Always build fresh from the board as it stands now; overwrite any earlier `sheet`.

One page the user keeps open during a live interview, glanced at in under two seconds. The board shows it
from the meeting's **Cheat sheet** button and makes the PDF in the browser; nothing else is stored. It
**condenses** what is already there — this meeting's `prep`, the user's notes, the latest mock (step 1),
`profile/me` — and adds no new fact, story or number (rule 1 still applies).

```json
"sheet": {
  "builtAt": "YYYY-MM-DD",
  "opener": "First line of the 60-90 second story, keywords only",
  "proof": "The one best-fit story, with its numbers",
  "whyRole": "One line",
  "whyCompany": "One line",
  "land": ["Three things to get across in this round"],
  "gap": "Honest framing for the biggest must-have gap",
  "watch": ["<biggest miss from the latest mock for this round>", "<top trap>"],
  "askThem": ["3-4 questions"]
}
```

**Keywords, not sentences.** Each item fits one line at 20pt on A4 — about 60 characters; never over 80.
Full sentences invite reading aloud, which shows on video. No interviewer names, time or round name: the
board reads those live from the meeting.

**`land` — three things, by the prep's mock type:**

| Type | The three |
| --- | --- |
| `screen` | Fit signals: scope match, motivation, salary or logistics stance |
| `pm` | Three competencies the ad prizes, each tied to a story |
| `domain` | Three domain proofs the role needs |
| `culture` | Three values they name, each with a story hook |
| `livecase` | A framework prompt, the metric to anchor on, "clarifying questions first" |
| `takehome` | Three headline points, plus the likely challenge to pre-empt |

A blended round takes from each of its types, the first type leading. If the latest mock shows the user
skipped something this round tests, that point takes one of the three.

**Live case and take-home:** `opener` and `proof` matter less. Write one combined line in `opener` and
leave `proof` as "".

**Priority when sources compete for a slot**, most specific first:
1. The user's notes from real rounds with this company (`conversations`).
2. The latest mock for this round type (`improve` and the fix/average `change` lines first, then `keep`; on older
   feedback `missed` and `improve` first, then `watchOuts`).
3. Employer-specific traps in this prep: from the `adSummary` and the Role Fit gaps (`avoid`, `focus`).
4. Generic watch-outs from `profile/me`.

**`watch`:** first the single biggest miss from the latest mock for this round type, as a reminder
("Name the consultancy fit early"), then the top trap. No mock: the top two traps.

**`gap`:** the must-have gap from `fit` that is most likely to come up, with the honest line from `avoid`
or `focus`. No must-have gap: the next most likely probe.

**`askThem`:** follows 1c — every starred open question first, then Claude's pick of the most important
open ones, 3-4 in all (the first 4 when 4 or more are starred). Never an answered one.

## Where things go on the board

Follow the Board Rules in `profile/brief` before writing anything to the board: what counts as a question
(short, ends in "?"), the field for every other kind of information, how conversations and meetings link,
and which commitment state puts an item on which Week ahead tab. That doc is the canonical copy; do not
restate it here.

Its **Keep it short** section binds the prep too. `tests` and any paragraph field: two sentences at most,
verdict first. Every list item — `focus`, `stories`, `avoid`, `likelyQuestions`, `askThem`,
`interviewGeneral` themes and stories, `digest` lists — within its list-item length.
`interviewIntel.notes`: two sentences. Detail worth keeping goes in the role's `notes`, not the prep.

## 5. Write back

Read each document first and pass its `version` as `if_version`. Write only:
- on commitments: `prep` (update; `prep.sheet` only on request, 4d), and new `unplanned` interview
  meetings or take-home tasks with `expected: true` (set, per 4 and 4a);
- on materials: `digest`, plus `text` and `textFrom` for an extracted copy (update, 1b), and new `text`
  materials only when the user asks in chat (1b);
- on roles: `interviewGeneral`, `notes` (append only) and `fit.suggest`;
- on companies: `interviewIntel`.

**Never write `qStar`, `qAnswers` or the question lists themselves** — those are the user's on the board.

**Never write `screenPrep` or `interviewPrep` on a role.** The board would move it onto a meeting, but
it should never need to.

## 6. Report

Only when something was written: per role, which prep was built, the round type, the single most
important thing to get right, and the top trap. For a cheat sheet: one line saying it's ready behind the
meeting's Cheat sheet button, and which mock it used (or none). Per material read: its title and the one thing in it
that changed the prep. Name any material that could not be read, and any prep built from the draft or
base CV rather than what was sent. Nothing to do → no report, no notification.

## Related

- `next-role-shortlist` (research before applying) and `next-role-apply-pack` (CV and cover letter) run
  before this. The user uploads the versions actually sent to `finals/<roleId>`.
- `next-role-meetings` — books the meetings this skill preps, and offers "Prep it now?" after booking.
- The board's **Mock interview** tab reads `profile/me`, the user's CV (the sent Word CV for that role,
  else `templates/cv.text`), the role (including `adSummary` and the `fit` requirements), the company's
  `interviewIntel`, the materials' `digest` (meeting materials only for the round being practised) and
  the meeting's `prep.mock`. It treats the next round as next even before it is booked. Its feedback
  names examples from the CV the user could have used, and checks answers against the user's own
  deal-breakers and concerns.
- The board's **Cheat sheet** button on a meeting renders `prep.sheet` as one big-type page and a PDF.
- `refs/screen-prep-baseline` — the baseline screen prep, when the board has one.
- `next-role-role-fit` — how Role Fit is scored and how to suggest changes to it.