---
name: "next-role-meetings"
description: "Adds, books, moves or completes meetings and tasks on a Next Role board by chat, and logs meeting notes, checking them against open questions. Use for \"book the screen for #N\", \"add a task…\", \"log my notes from…\"."
---

# Meetings, tasks and notes

The chat version of the board's **Add meeting / task** form and its **Log a conversation** form. It writes
exactly what those forms would write, so the board shows it the same way. Use it whenever the user asks,
in chat, to add, book, move, rename, complete or cancel a meeting or task, or to log notes from a meeting.

## Where everything lives

**The board is the source of truth.** Read and write it with the artifact database tool (`ArtifactData`;
load it with ToolSearch "select:ArtifactData" if needed). The board's URL comes from the project's
instructions or the prompt; if neither gives one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules, the words to use, Keep it short | `profile/brief` — read it first. Its **Meetings and tasks** and **Answers to questions** sections are canonical; if they disagree with this skill, the brief wins |
| Deal-breakers and preferences | `profile/prefs` (`hardRules`, `scored`) |
| Limits (meeting hours, prep lead, default durations) | `profile/settings`; a missing value means use the default below |
| Meetings and tasks | `commitments` |
| Meeting notes | `conversations` |
| Roles, companies, sectors, people | `roles`, `companies`, `sectors`, `people` |

Use `profile/brief`'s words (its "Say vs stored as" table) in every reply and on the board: Longlist,
Shortlist, To apply, Applied; the task type stored as `pack` is said the way the brief says it.

**Empty board / nothing to do.** If the ask names nothing to add, move or log, or the role, meeting or
person it names isn't on the board, say so in one line and ask which one is meant. Don't create anything
on a guess.

## What it must not do

1. **Never invent a fact.** No date, time, person or type that the user did not give or that is not on
   the board. If one is missing and it matters, ask (see 2). Otherwise leave it empty.
2. **Never delete** a meeting or task without the user confirming that exact item. Cancelling a booked
   meeting means setting `state: "unplanned"` (date, time cleared) unless the user says to remove it.
   Removing a repeating item removes every occurrence — confirm that in so many words.
3. **Never write prep advice.** `prep` belongs to `next-role-interview-prep`. This skill only offers it.
4. **Never mark a question answered without the user's yes.** Proposed answers wait as suggestions (see 4c).
5. Never touch the frozen `db` namespace. Never use a logged-in LinkedIn session.

## 1. Work out the item

| Ask | Meaning |
|---|---|
| **Meeting or task?** | A meeting has a time, a duration and people. A task has a due date only. |
| **For what?** (`forKind` / `forId`) | `role`, `company`, `sector`, `person`, `meeting` (tasks only) or `none`. Find the id on the board: roles by number ("#N" = the role whose `ref` is N), companies, sectors and people by name. |
| **Type** | Depends on the "for" — list below. Pick the closest; if none fits, `other` / `othertask`. |
| **Title** | Short, "<Company> — <round or purpose>", e.g. "<Company> — Recruiter screen", "<Company> — Round 2: Case study presentation". |
| **Planned?** | A date given → `booked`. No date yet → `unplanned` ("Not planned yet"); date, time, duration and people are then optional. "Every …" → `recurring` (see 4b). |

Meeting types by "for":

- **role**: `informal` Informal chat, `screen` Recruiter screen, `hm` Hiring manager interview,
  `domain` Domain interview, `sense` Product sense / design, `competency` Competency, `culture`
  Culture / fit, `panel` Panel, `livecase` Live case study, `casepres` Case study presentation, `exec`
  Exec / founder chat, `test` Test / assessment, `ref` Reference / offer call.
- **company**: `coffee` Coffee chat, `info` Info interview.
- **sector**: `event` Event / meetup, `info` Info interview.
- **person**: `recintro` Recruiter intro, `recchk` Recruiter check-in, `catchup` Catch-up.
- **none**: `training`, `mentoring`, `mock` Mock interview, `other`.

Task types (any "for"): `prep`, `takehome` Take-home case study, `onlinetest`, `pack` CV and cover letter,
`followup` Follow-up / thank-you, `chase`, `research`, `practice` Practice / training, `othertask`.

A take-home is two items: a `takehome` **task** (due date = submission) and a `casepres` **meeting**
where it is presented.

## 2. Ask only what is missing and matters

Ask in one short message, never one question at a time. Ask for:
- the **date** if the user said it is booked but gave none;
- the **time** for a booked meeting, within `profile/settings` `meetings.dayStart`–`meetings.dayEnd`
  in `meetings.timeStepMinutes` steps (defaults 07:00–20:00, 15) — if the user doesn't know, leave it empty;
- **who** for a booked role interview, if nobody was named — optional, accept "don't know";
- **"Add a prep task?"** for any booked meeting — default yes for role interviews, `meetings.prepLeadDefault`
  days before (default 1); the prep date must be 1 to `meetings.prepLeadMax` days before the meeting
  (default 14), never the same day;
- for a repeating item, the **days** (or day of the month) if the user didn't say.

Don't ask about duration: default `meetings.durationShort` (default 30) for screens and informal chats,
`meetings.durationLong` (default 60) for other interviews, blank otherwise, and say what you used.

## 3. Check the board before writing

1. **Avoid duplicates.** For a role meeting, look for an existing meeting for that role with the same
   `type` and `state: "unplanned"`. If there is one, **update it** (book it) — never create a second.
   This is how the Not planned rounds that `next-role-interview-prep` created get booked, keeping their
   `prep`. For a repeating item, check no `recurring` item with the same title already exists.
2. **People.** Match each person by name in `people`. A person not there gets a new `people` doc first:
   id = slugified name (add `-2`, `-3` if taken), fields
   `{name, role, how, companyId, company:"", linkedin:"", note:"", addedAt:<today>}`. `role` is their job
   title as the user gave it; `how` is the relationship (recruiter, hiring manager, interviewer,
   referrer…). New role names are fine: the board's list grows from what is used.
3. **Tagged roles.** If the meeting also covers other roles (a recruiter call about two roles), put the
   extra role ids in `tagRoles` so it shows on their cards too.

## 4. Write the item

Collection `commitments`. New id: slugified title (max 48 chars) + "-" + 4 random base-36 chars, or for
an interview round `<roleId>-r<n>-<slug>`. Read any existing doc first and pass its `version` as
`if_version`.

```json
{
  "item": "meeting",               // or "task"
  "type": "screen",
  "title": "<Company> — Recruiter screen",
  "detail": "",
  "forKind": "role", "forId": "<roleId>",
  "roleId": "<roleId>",            // the role, or the role of the meeting a task is for; else ""
  "tagRoles": [],
  "org": "<company name or ''>",
  "personIds": ["<people id>"], "person": "<names, comma-separated>", "relationship": "<first person's how>",
  "state": "booked",               // booked | unplanned | done | recurring
  "date": "YYYY-MM-DD", "time": "HH:MM", "duration": 30,
  "prepLead": 1,                   // booked meetings only: days before for the prep task; 0 = no prep task
  "kind": "external",
  "createdAt": "YYYY-MM-DD",       // new items only
  "order": 1                       // new unplanned items only: one more than the highest sibling order
}
```

Tasks: `personIds: []`, `person: ""`, `time: ""`, `duration: ""`, no `prepLead`.
Unplanned: `date`, `time`, `duration` all `""`.

The prep task is **not** a separate document: `prepLead` on the meeting puts a prep task on the Week
ahead that many days before.

**Moving / completing / cancelling:** update only the fields that change — new `date`/`time`; `state:
"done"` when it has happened; back to `unplanned` with date and time cleared when it is called off but
still expected.

## 4b. Repeating meetings and tasks

One document per series; the board works out each occurrence and stores only the ticked dates
(`doneDates`, which the board manages — never write it). Same fields as above, plus:

```json
{
  "state": "recurring",
  "date": "",
  "repeatEvery": "week",           // week | fortnight | month
  "repeatDays": [1, 4],            // week and fortnight: weekday numbers, 0 Sun .. 6 Sat; [] for month
  "repeatDate": "",                // month only: day of the month, 1-31 (a shorter month uses its last day)
  "startsOn": "YYYY-MM-DD",        // defaults to today; for fortnightly, the week it falls in is week one
  "endsOn": "",                    // optional
  "time": "HH:MM", "duration": 60  // meetings only; "" for tasks
}
```

No `prepLead` on a repeating item. Examples: "review the longlist every Monday and Thursday" → task, week,
`[1,4]`; "mentoring every other Wednesday at 9" → meeting, `type: "mentoring"`, fortnight, `[3]`,
`time: "09:00"`; "update my tracker on the 1st of each month" → task, month, `repeatDate: 1`.

To change a series, update its fields; to stop it, set `endsOn` (keeps the history) unless the user asks
to remove it.

## 4c. Meeting notes, and the questions they answer

When the user gives notes from a meeting ("log my notes from the <Company> screen: …"):

1. **Write the notes** to `conversations`, exactly as the board's Log a conversation form does. New id:
   `<date>-<slug of role id or subject>-<4 random base-36 chars>`.

   ```json
   {
     "date": "YYYY-MM-DD", "kind": "<call | interview | chat | email | other>",
     "roleId": "<roleId or ''>", "companyId": "<company id>", "sectorId": "<'' when there is a role or company>",
     "subject": "<'' when there is a role; else the person or topic>",
     "who": "<name and role>", "liked": "", "concerned": "",
     "nextQuestions": ["<new questions to ask them — each ends with ?>"],
     "notes": "<anything that is not a question>",
     "meetingId": "<the commitments id of the meeting it came from, or ''>",
     "nextStep": "", "nextStepDate": ""
   }
   ```

   Use the user's words; sort them into liked / concerned / notes only where the user made it clear. If
   the meeting was booked on the board and is now past, also set that meeting's `state: "done"`.
2. **Check the open questions.** For the role (and, when the notes are about a company, every live role
   there): gather the open questions — the role's `enrich.openQuestions` and its notes' `nextQuestions`
   (answers live on the **role**), the company's `questions` and its sector's `questions` (answers live on
   the **company**). A question is open when no `qAnswers` entry on that doc has the same text (compare
   trimmed, lower-case). Skip any already in the role's `qSuggest`.
3. **Find the answers** the new notes clearly give. Only what the notes say — a note that touches a topic
   without answering it does not count. One short sentence per answer, following `profile/brief`'s Keep
   it short rules.
4. **Ask in the same reply**: list each proposed answer under its question and ask "File these?" (the
   user can say which ones).
   - **Yes** → append to that doc's `qAnswers` array `{q:<exact question text>, a, at:<today>, src:"notes",
     convId:<the conversation id>}` (read the doc, write the whole array back with `if_version`).
   - **No answer, or the user isn't there** → append them to the role's `qSuggest` array instead
     `{q, scope:"role"|"company", sid:<role id or company id>, a, convId, date:<note date>, at:<today>}`.
     The board shows them on the Questions tab with Accept / Dismiss.
5. **Criteria nudge.** If an answer bears on a deal-breaker or preference in `profile/prefs` (pay, pension
   or package; office days or travel; contract type; hours; right to work; title or level — match by the
   rule's name and text), say so in the reply, naming the rule the way the board does (its name with its
   id) and carrying the rule in a few words, e.g. "May change <rule name> (<id>: <rule in a few words>) —
   worth a look on Fit." Never change Fit or the rules yourself.

## 5. Knock-on writes

- **Booking an interview on a role at `applied` or `offer`** (any role meeting type except `informal`)
  → set the role's `flowStatus: "prep"` and `flowPrev` to its previous `flowStatus`, as the board does.
  Only when the meeting moves to `booked` for the first time.
- **Notes** → only the writes in 4c.
- Nothing else. Stages, scores and `stage` are never changed here.

## 6. Reply

One or two lines: what was written, as the user would see it on the board (e.g. "Booked: <Company> —
Recruiter screen, <day date> <time>, 30 min, with <name> (new person). Prep task <day before>.", or
"Repeats every other Wed at 09:00 from <date>.", or "Logged your notes on #N. They answer 2 open
questions: … File these?").

Then, for a **role interview** (any role meeting type except `informal`) with no `prep` on it, offer:
**"Prep it now?"** — a yes runs `next-role-interview-prep` for that role straight away. Otherwise that
skill's scheduled run writes it.

## Related

- `next-role-interview-prep` — writes `prep` on role interview meetings, creates Not planned rounds, and
  reads the company's interview materials.
- `profile/brief` › Meetings and tasks, and › Answers to questions — the canonical field lists.
- Board doc `refs/skills` — the manifest of every `next-role-*` skill, shown on How to use › Under the hood.