---
name: "next-role-daily-check"
description: "Daily upkeep for a Next Role board: checks every Longlist, Shortlist (parked included) and To apply role is still open, folds week-old longlist rejections, finds job boards for new companies, and works the Data health fix queue. Never decides or scores."
---

# Daily check — keeping the board honest

A short, cheap pass that runs every day, before the research and the other morning passes. It keeps
the board true: roles that have closed are caught, settled rejections are folded away, new companies get
their job board found, and any fixes still queued are done. It does no company research.

## Where everything lives

**The board is the source of truth.** Read and write it with the artifact database tool (`ArtifactData`).
The board's URL comes from the scheduled task's prompt or the project's instructions; if neither gives
one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use) | `profile/brief` — read it first; it binds every write |
| Limits and switches (listing age, when to fold, job-board look-ups a run) | `profile/settings`; a missing value means use the default below |
| Roles, companies, folded decisions, fix queue | `roles`, `companies`, `decided`, `fixqueue` |
| Keys of folded rejections, read by the sweep | `refs/rejected-keys` |
| ATS endpoints | `refs/ats-endpoints` |

**Empty board.** If there are no roles at Longlist, Shortlist (parked included) or To apply, no rejections
to fold, no companies whose job board is unknown and no queued fixes, say so in one line and stop.

## The three things this pass must not do

1. **It must not decide**, with one exception: a role the employer has closed, at Longlist, Shortlist, parked
   or To apply (step 1). Applied roles are never closed by this pass.
2. **It must not score Fun or Shot.**
3. **It must not claim a role is open without proof.** `linkChecked` is only written from the employer
   board's index of current openings or a real browser session, never from a fetched page.
   **Nor closed without proof.** Missing from a list you didn't read to the end is unknown, never gone.

## 1. Check every open role is still open

Check every role at `stage: "proposed"` (Longlist), `"consideration"` (Shortlist), `"parked"` (parked on
the Shortlist) and `"prep"` (To apply) that has a `url`. Skip roles with `source: "self"`, a
`contact.personId` and no `url`: the person confirms those. Skip closing any role with `keepOpenAt` set: the
user said it is still open after an earlier close. You may still write `linkChecked` for it from an index.

**How to check, best first:**
1. **The employer board's index of current openings** (the company row's `boardAts` / `boardUrl`, or the
   ATS JSON endpoints in `refs/ats-endpoints`). Read each board once and check all its roles against
   it. In the index: write `linkChecked: <today>`, `linkMethod: "index"`.
   **Not in the index counts only when you read the whole index.** Fetch tools cut long pages off without
   always saying so (a big ATS feed can run past 100,000 characters). Before calling a role missing, make
   sure you saw the end of the list: read the rest (an offset or the next page), or use a smaller list
   that would contain the role (the careers page filtered to the role's team, or the ATS search for its
   title). If you can't be sure you saw the whole list, the result is **unknown**, not gone: leave
   `linkChecked` as it is and say so in the report.
   **Shortlist, parked and To apply need a second signal.** When a full read says one of these is missing,
   also fetch the posting itself. Gone only if the posting is closed or missing too ("no longer accepting
   applications", "job not found", a redirect to the general careers page). If the posting still shows
   the role with a way to apply, call it unknown and leave it for tomorrow (indexes lag). A Longlist role
   missing from a fully read index is gone on that alone.
2. **No index** (LinkedIn, job boards, recruiters, browser-only sites): fetch the posting. **A fetch can
   prove a role closed, never open.** If the page says it's closed ("no longer accepting applications",
   "this position has been filled", "job not found"), the role is gone. Otherwise leave `linkChecked` as
   it is and set `liveCheck: "you"` if it isn't set.
3. **A Longlist listing older than `profile/settings` `roles.maxListingAgeDays` (default 45)** with no
   index confirmation counts as gone.

Don't overturn an earlier finding that a role closed without browser evidence.

**What happens to a gone role:**
- **Longlist:** move it to `g1_rejected` with `endBy: "neither"`, `endReason: "Role pulled or filled"`,
  `endNote: "<how you found it closed> on <date> — closed by the daily check"`, `endStage: "Gate 1"`,
  `endAt: <today>`. The employer has already decided, and the user never sees it go.
- **Shortlist, parked or To apply:** close it, and the board asks the user to acknowledge it. Set
  `stage: "g2_rejected"`, `endBy: "neither"`, `endReason: "Role pulled or filled"`,
  `endNote: "<how you found it closed> on <date> — closed by the daily check"`, `endStage: "Gate 2"`,
  `endAt: <today>`, `closedBy: "daily-check"`, `prevStage: <the stage it was at: "consideration", "parked" or
  "prep">`, `ackAt: ""`. Don't touch `g2At`. Don't add a red flag.
- **Already flagged:** a Shortlist, parked or To apply role that still carries an older red flag starting
  *"Gone from"* (from before 5 Oct) is closed the same way on this run, unless `keepOpenAt` is set; the flag
  stays as it is.

**Catch-up rough fit.** Any open Longlist role with no `fit` (a role that arrived some other way, or a
sweep that ran out of budget) gets a rough Role Fit following the `next-role-role-fit` skill
(`rough: true`, from the listing and anything you fetched while checking it, no extra fetches).

## 2. Fold week-old longlist rejections

Take roles at `stage: "g1_rejected"` whose rejection date (`endAt`, else `g1At`) is at least
`profile/settings` `roles.foldAfterDays` old (default 7). Merge them into `decided/<today>-g1` and delete
those role documents. Younger rejections stay as rows so the user can still undo them. Folding is this
pass's job; the user is never asked to do it.

```
decided/<date>-g1
  date, count,
  reasons:   { "<reason>": n },             // kept forever
  quadrants: { hh, hl, lh, ll },            // Fun × Shot, kept forever
  items: [ { title, company, url, fun, shot, reason, note, seen, source, sourceId,
              rec: { …the role document, without enrich } } ]
```

`reason` is the role's `endReason` (or `g1Reason` on older rows); `note` its `endNote` (or `g1Note`).
**Keep the whole role in `rec`**: the board reads folded roles back from it, so Insights keeps their
channel, fit, sector and how they ended. If today's document already exists, add to it. If it would pass
about 200 KB, continue in `decided/<date>-g1-2`. Shortlist rejections are never folded.

**Then record the keys of each folded role the user or the employer turned down (`endBy` `me` or `them`)
in `refs/rejected-keys`, before deleting its row**, so the sweep never brings it back. Roles the employer
pulled or filled (`endBy` `neither`) are not recorded: if they come back, they may have reopened. Read the
doc, append one entry per recorded role to `items`, and write it back pinned to the version you read (on a
conflict, re-read and append again; never drop someone else's entries):

```
{ urlKey, url, companyKey, titleKey, company, title, location, seen, postingAge, by: <endBy>, reason, at: <endAt, else g1At>, from: "decided/<doc id>" }
```

Build the keys with the doc's own `keyRules`. Skip a role already listed (same `urlKey`, or same
`companyKey` plus `titleKey`). Update `count` and `updatedAt`. If the doc would pass about 200 KB, drop the
entries with the oldest `at` first, never one less than 180 days old. Fold and record in the same run: if the
keys can't be written, don't delete those role rows; leave them for tomorrow and say so in the report.

## 3. Work the fix queue

Data health no longer queues fixes for the morning (since 6 Oct its Claude fixes are copied into a chat and
worked by `next-role-fix`), but jobs queued before then may remain. Read every `fixqueue` document with
`status: "queued"` (`{kind, targetId, label, queuedAt}`):

| `kind` | `targetId` | The job |
| --- | --- | --- |
| `recheck-link` | a role id | Check it as in step 1. Gone: close it as step 1 says for its stage (never an Applied role, never one with `keepOpenAt`) |
| `role-fit` | a role id | Score Role Fit with the `next-role-role-fit` skill from the full ad, unless the user has edited the fit |
| `company-card` | a role id | Create the company row for the role's company following the `next-role-shortlist` skill's company pass, and set the role's `companyId` |

Any other `kind`: mark it `status: "done"`, `note: "No longer used"`. Then set `status: "done"`,
`doneAt: <today>` and a short `note` on each job. A job that can't be done is still marked done, with why
in `note`; never leave it queued, never guess.

## 4. Find job boards for companies that have none recorded (last)

Take every company that is on the list (`listing` not `excluded`, `defunct` or `rejected`), **rated Want it or
Would consider** (`priority` `high` or `medium`), with no `boardAts`, no `boardUrl` and no `boardNeedsAlert`,
up to `profile/settings` `daily.maxBoardFinds` a run (default 25). Skip If it appears (`low`) and unrated
companies: the sweep never reads their boards, so there is nothing to find. When the user later rates one Want
it or Would consider, it is picked up here. Each company is looked up once: once it has a board or a
`boardNeedsAlert` flag it never comes back.

This step runs **last**, so a big batch of newly rated companies can only delay itself, never the role checks
or the folding. If companies are left over, the run is capped: say how many in the report (the run record's
`left`), and they are first in line tomorrow. For each, work out once how its roles can be read:

1. **A public ATS board** (Greenhouse, Lever, Ashby, Workable, Recruitee, Teamtailor, Personio, BambooHR and
   the rest in `refs/ats-endpoints`): find the company's slug from its careers page or a search, and
   confirm the JSON endpoint answers with one fetch. Write `boardAts: "<ats>"`, `boardUrl: "<endpoint>"`,
   `boardStatus: "ok"`.
2. **A plain careers page that lists roles as readable HTML**: `boardAts: "html"`, `boardUrl: "<page>"`,
   `boardStatus: "ok"`.
3. **Neither** (JavaScript portals such as Workday, Phenom or Oracle; robots-blocked; a login; very large
   boards of 100 or more jobs; no careers page found): write `boardNeedsAlert: true`,
   `boardStatus: "needs-alert"` and a short `boardNote` saying why. Data health then lists it under Companies
   that need a LinkedIn alert; the user adds it (or asks Claude to, with `next-role-fix`), and Alert set makes
   it `boardAts: "linkedin-alert"`.

Never write `boardAts: "linkedin-alert"` in this pass: it runs unattended and can't confirm the alert exists.
Only `next-role-fix` writes it, after adding the company to an alert in the browser and seeing it there.
Don't read roles here; the sweep does that. One or two fetches per company, no more.

## Writing

Merge fields; never replace a role or company row. Never clear `linkChecked`. Every text field follows
`profile/brief`'s Keep it short rules.

## 5. Report, briefly

Roles closed on the Longlist and how each was found closed; Shortlist, parked and To apply roles closed
(waiting for the user to acknowledge), with their stage; roles that couldn't be checked; how many rough fits
were caught up; how many rejections were folded and their keys recorded; job boards found, which companies need a LinkedIn alert, and
how many companies are left for tomorrow if any; fix-queue jobs done and any that couldn't be done, with why.

## Related

- `next-role-sweep` — builds the longlist; reads the boards this pass finds, as often as each company's rating says, and skips any find listed in `refs/rejected-keys`.
- `next-role-shortlist` — researches shortlist roles (parked included, once) and their companies.
- `next-role-role-fit` — how Role Fit is scored.
- `next-role-fix` — the Data health fixes the user asks Claude for, including LinkedIn alerts.