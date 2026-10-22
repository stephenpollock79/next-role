---
name: "next-role-fix"
description: "Works Data health fixes on a Next Role board that the board can't do itself: re-checks, scores, company cards, job sites it can't read yet, LinkedIn alerts, stopped runs, sources, scheduled tasks, board errors. Use for a pasted \"Run next-role-fix\" request."
---

# Data health fixes

Data health on the board sorts every problem into three routes: the board fixes it now (with undo), **Claude
fixes it when asked** (this skill), or it needs the user (decisions and scores). The user presses **Copy for
Claude** (one problem) or **Copy all for Claude** and pastes the request here. It looks like:

```
Run next-role-fix on my Next Role board. Work each kind below, then tell me what you did and anything left for me.

linkedin-alert — Companies that need a LinkedIn alert:
- acme · Acme · Would consider
recheck-link — Job ads not checked for over two weeks:
- <role id> · #12 Senior PM · Acme (Shortlist · last checked 20 Sep)
```

Each line is `- <id> · <label> (<note>)`. The id is a document id (role, company or meeting), or for the
"Is it running" kinds an id the board made up (`tr-<task type>`, `lim-<task type>`, `lim-sweep`, `sb-<source id>`,
`sq-<source id>`, `gm`, `gl`, `er-<date>`); the label says the rest.

**It fixes; it does not decide.** Never change a role's stage except where a kind below says so, never score
Fun or Shot, never rate a company. Anything that turns out to need a decision goes back to the user in the
report.

## Where everything lives

**The board is the source of truth.** Read and write it with the artifact database tool (`ArtifactData`).
The board's URL is the link in the pasted request (the board puts it there); without one, the link in the
project's instructions; if there is none, ask for it.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use) | `profile/brief` — read it first; it binds every write |
| Limits and switches | `profile/settings` |
| Roles, companies, meetings, sources, channels | `roles`, `companies`, `commitments`, `sources`, `channels` |
| Run records | `runs` (sweeps), `taskruns` (each scheduled task: `{type, date, at, model, status, capped, cappedNote, left, note}`); `left` is how many items a capped run left undone, `model` the model the run used |
| Board errors | `errlog/<YYYY-MM-DD>` `{day, n, msgs:[{msg, where, at}]}` |
| ATS endpoints, and the per-site patterns for reading one ad (section 1c) | `refs/ats-endpoints` |

Every write merges with `update`, pinned with `if_version` (read the document first). Never replace a row,
never clear `linkChecked`.

**Order.** Do the cheap kinds first (`recheck-link`, `role-fit`, `company-card`, `find-link`,
`read-posting`), then the browser ones (`site-pattern`, `linkedin-alert`), then the slow ones (`build-pack`,
`interview-prep`, `sweep-overdue`, `task-run`), then `run-limits`, then `source-*` and `board-error`. If the list
is long, say how many there are and go; don't ask first.

## The kinds

### `recheck-link` (role ids)
Check the role is still open exactly as `next-role-daily-check` step 1 says: the employer board's index
first (write `linkChecked: <today>`, `linkMethod: "index"` when it's there); otherwise a fetch, which can
prove a role closed but never open. A real browser session also counts as proof it's open: open the
posting in the browser and, if it shows as live, write `linkChecked: <today>`, `linkMethod: "browser"`.
Gone: close it as that step says for its stage (never an Applied role, never one with `keepOpenAt`).

### `role-fit` (role ids)
Score Role Fit with the `next-role-role-fit` skill from the full ad, unless the user has edited the fit.

### `company-card` (role ids)
Create the company row for the role's company following the `next-role-shortlist` skill's company pass, and
set the role's `companyId`. If a row already exists under another slug, link that one instead.

### `find-link` (role ids)
The role has no `url`, `spec` or `pasted`. Search the employer's own careers site or ATS board for the same
role (title, location). Found: write `url` (keep any other link in `sourceUrl`), and `linkChecked: <today>`,
`linkMethod: "index"` only when found in the board's index. Not found: say so in the report; if the role
came through a person (`contact.personId`), it is theirs to confirm.

### `read-posting` (role ids)
The morning run couldn't read the ad (`readState: "needs"`, `readReason`; a `nofeed` role comes as
`site-pattern` instead). Try, in order: the employer's own
posting (search their careers site by title); a public copy (an aggregator that names the employer); the page
in the user's browser if it needs JavaScript. **Never read a posting through a logged-in LinkedIn session.**
On success: write `pasted` with the ad's text, set `readState: "read"`, clear `readReason`, and run
`next-role-longlist-research` on that role if it is on the Longlist (or `next-role-shortlist` if on the
Shortlist). On failure: leave it, and ask the user in the report to paste the text.

### `site-pattern` (role ids; each line ends `· site <host> · <link>`)
The roles' ads are on a careers site that builds the ad with JavaScript, and `refs/ats-endpoints` section 1c
has no pattern for that site yet (`readReason: "nofeed"`, `readHost`). Work out the site's feed once, so the
cloud runs can read every ad on it with a plain fetch. Group the lines by host and do one host at a time.

1. **Open one flagged ad in the browser** (the built-in browser unless the user says otherwise; read that
   browser's skill first). If no browser is available, stop this kind and say so. Decline non-essential
   cookies. Never sign in to anything.
2. **Find the feed.** Read the page's network requests after it loads and pick the one that returns the ad's
   text (title, responsibilities, requirements), usually JSON from the same host or the ATS vendor's API.
   Note which parts of the job link (job id, site or board name, tenant) appear in it.
3. **Write the pattern** as a row for the table in section 1c: ATS name, what the host looks like, what the
   job link looks like, the feed address with the link's parts as `<placeholders>`, and the status. Encode
   characters the way the working request did.
4. **Verify it with a plain fetch, the way the cloud runs read** (WebFetch, never the browser): build the
   address from the link for the ad you opened, and for a second flagged ad on the same system if there is
   one. Both must return the full ad. If they don't, try once more from the network requests; otherwise stop
   for that host and say what you found.
5. **Save it.** Add the row to section 1c of `refs/ats-endpoints` (`str_replace` on `md`, pinned), status
   "**Verified <date>** on <company> job <id>", and set `updatedAt`. One row per ATS: if the vendor already
   has a row and only the host differs, widen that row's host instead of adding another.
6. **Send the roles back to be read.** For every role on the board with `readReason: "nofeed"` and a
   `readHost` the new row covers (not only the ones in the request): set `readState: "waiting"`,
   `readReason: ""`, and on a Longlist role remove `llAt` (`{"__delete__": true}`), so the next morning run
   reads each ad properly and replaces the rough Role Fit. Leave everything else on the role alone.
7. If the user wants them now, run `next-role-longlist-research` for the Longlist ones and
   `next-role-shortlist` for the rest, here in the chat.

Never write `linkChecked` from a feed read: a feed returns the ad, it doesn't prove the role is open.
Nothing to write in `fixes`: the check clears as soon as the roles change.

### `linkedin-alert` (company ids)
Only for companies rated Want it or Would consider (the board only lists those). The user's LinkedIn job
alerts all use the same keyword search and location, each with a company filter; LinkedIn caps how many
companies one alert can hold (in practice about 14).

1. Use the browser where the user is signed in to LinkedIn (Claude in Chrome unless they say otherwise; read
   that browser's skill first). If no browser is available, stop this kind and say so.
2. Open LinkedIn Jobs › **Job alerts** (manage alerts) and note the keyword string and location from an
   existing alert.
3. For each company: if it is already in an alert's company filter (each alert's search link carries the
   companies as `f_C=` ids), skip to step 5. LinkedIn's Edit job alert only changes frequency and notification
   type, and changing an alert's search makes a second alert, so an existing alert can't take a new company
   without duplicating it.
4. Run the same keyword search with the same location, filter it to the companies still to add (all of them
   in one search, up to about 14), and turn on "Get job alerts for this search": daily, email and
   notification, like the others.
5. Check it took: the alert's filter list names the company.
6. On the board, update the company: `boardAts: "linkedin-alert"`, `boardNeedsAlert: false`,
   `boardStatus: "alert"`, `boardAlert: "LinkedIn alert (set <YYYY-MM-DD> by Claude)"` — the same fields the
   board's Alert set button writes. Only after step 5 succeeded.

Only add companies; never delete or rename an alert, never change its keywords or frequency, and never
apply for anything or message anyone.

### `build-pack` (role ids)
Run the `next-role-apply-pack` skill for those roles.

### `interview-prep` (role ids; the label names the meeting)
Run the `next-role-interview-prep` skill for those roles ("prep the interview for #N").

### `run-limits` (`lim-<task type>`, or `lim-sweep`)
The board lists a run here only when its last three runs all stopped early and the work left over didn't
shrink (the label gives the dates, the `left` counts when recorded, and the latest `cappedNote`). A run that
stops early once while a backlog clears isn't listed. **Find out why it keeps happening and propose a lasting
fix; don't just finish the backlog.**

1. Read that type's last few records (`taskruns` for a task, `runs` for the sweep): `cappedNote`, `left`,
   and what each run did. Read the limits that skill uses in `profile/settings` (e.g. `daily.maxBoardFinds`,
   `longlist.maxRoles`, `sweep.maxToolCalls`).
2. Work out what fills the run: which step runs out, and what is driving the volume. For example: many
   companies newly rated up; a channel or search term bringing in lots of roles that are then screened out; a
   skill doing work it shouldn't (as when the daily check looked up boards for If it appears companies); a
   limit set too low for normal volume.
3. Propose the lasting fix, smallest first: change one setting (give the value and why), trim a channel or
   search term, or change a skill (propose it as a skill update). Say what each would change.
4. Apply a setting change only when the user agrees in the chat. Skill changes go through the usual skill
   proposal.
5. If the user also wants the backlog cleared now, do what's left by that skill's own steps, then add a
   `taskruns` document `<type>-<today>-fix`: `{type, date: <today>, at: <now ISO>, status: "ok",
   capped: false, left: 0, note: "Finished the rest from chat"}`.

An older request may say `finish-run` (with `tc-<type>` or `cap` ids): treat it as `run-limits`.

### `task-run` and `sweep-overdue` (`tr-<task type>`, or the sweep)
1. List the scheduled tasks and find the one that runs that work: its prompt names the `next-role-*` skill.
   The morning run is two tasks (since 13 Oct): part 1 runs daily-check then longlist research, part 2 runs
   shortlist, apply-pack then interview-prep. Fire the part that holds the overdue skill, not the other one.
2. Report its state: on or off, next run, last run and whether it failed.
3. If it is off, or the last run failed, or it is overdue: run it now (fire it). Don't change its schedule,
   prompt or model unless the user asks.
4. If there is no such task, say so; don't create one without asking.

### `source-quiet` and `source-access` (`sq-<source id>`, `sb-<source id>`, `gm`, `gl`)
Read the source's document in `sources` and its results in the last few `runs`. Test it the way the sweep
reads it (fetch the board or search; for alert emails, search Gmail for the label in `profile/settings`
`alerts.gmailLabel`).
- **Fixable here:** a moved URL, a changed ATS slug, a search that needs rewording. Update the source and say
  what changed.
- **Needs the user:** Gmail not connected to Claude (`gm`), a Gmail label or filter that stopped catching
  alerts (`gl`), a site that now needs a login. Say exactly what to do.
- **Genuinely quiet:** the source works but has had no matching roles. Say so; suggest moving it to Manual or
  dropping it, and leave the choice to the user.
- **Logged wrongly:** the source reads fine now, but the run records show `status: "ok"` with `read` (or, on
  older records, `found`) at 0 and no note, so the sweep didn't log what it read. Say so; nothing to fix on
  the source. `source-quiet` keys on `read`: a source that reads listings but passes none is not a Data
  health item, it shows in Highlights as "nothing that fits".

### `board-error` (`er-<date>`)
Read `errlog/<date>`. Read `claude/board-architecture.md` in the project, fetch only the board files the
error points at, find the cause, fix it, check with `node --check`, and publish the board as the project's
instructions say (bump the cache key; update the architecture doc's Last verified line). Then delete that
`errlog` document so the check clears. An error you can't reproduce or fix: leave the log and say so.

### Any other kind
Say it isn't known to this skill and leave it.

## Mark what you fixed (run-based checks)

Some checks read run records, not the row you changed: `source-access`, `source-quiet` (`sb-…`, `sq-…`, `gm`,
`gl`), `task-run` and `sweep-overdue` (`tr-…`), and `run-limits` (`lim-…`). They only clear once the next run
records the result, so after fixing one, write `fixes/<item id>` (the id from the request line, e.g.
`sb-job-boards-acme-jobs`) with `set`:
`{item: <item id>, kind: <kind>, date: <today YYYY-MM-DD>, at: <now ISO>, what: <one line: what you changed>, by: "claude"}`.
The board then takes the item off the to-do list and shows it under "Fixed by Claude, waiting for the next run to
confirm"; if the next run still shows the problem, it comes back saying the fix didn't hold. Write it only for a
real fix (a setting changed, a task re-run), never for "needs the user" or "genuinely quiet". A doc for that id
from an earlier fix is overwritten. Other kinds clear by themselves once the row changes: write nothing.

## Report, briefly

One line per kind: what was fixed (by name), what couldn't be and why, and what is now on the user. Data
health updates by itself once the board sees the changes; don't tell the user to refresh.

## Related

- `next-role-daily-check` — the morning upkeep; still works any old jobs left in `fixqueue`.
- `next-role-role-fit`, `next-role-shortlist`, `next-role-longlist-research`, `next-role-apply-pack`,
  `next-role-interview-prep`, `next-role-sweep` — the skills these fixes run.