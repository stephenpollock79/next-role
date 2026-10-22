---
name: "next-role-longlist-research"
description: "Longlist research for a Next Role board: reads pasted links, then gives every unresearched Longlist role its deal-breaker results, highlights, flags and Role Fit. Never decides or scores. Run by the sweep and the morning task, or \"run the longlist research\"."
---

# Longlist research

Gives every Longlist role the same picture, however it arrived: found by the sweep, pasted by the user, or
rescued by the weekly check. **It records; it does not decide.** Whether a role goes to the Shortlist, and
its Fun and Shot, are the user's.

It is cheap by design: one role at a time, no company research, no pay research. The deep research is
`next-role-shortlist`'s, and runs only on roles the user sends on.

## Where everything lives

**The board is the source of truth.** Read and write it with the artifact database tool (`ArtifactData`).
The board's URL comes from the scheduled task's prompt, the calling skill, or the project's instructions;
if none gives one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use) | `profile/brief` — read it first, every run; it binds every write |
| Deal-breakers, preferences, pluses, concerns | `profile/prefs` — read it live every run |
| Limits | `profile/settings` `longlist`; a missing value means use the default below |
| Roles, companies, sectors | `roles`, `companies`, `sectors` |
| How to read ads on sites that load them with JavaScript | `refs/ats-endpoints` section 1c |

A deal-breaker's `check` note says how to test it and wins over anything general here. Name a rule the
way the board does (its name with its id) in everything you write.

## Who calls it

- **`next-role-sweep`**, as its last step, on the roles that sweep wrote. Posting text the sweep already
  read in the same session is used as is; never fetch it again.
- **The morning task**, after `next-role-daily-check` and before `next-role-shortlist`. It catches pasted
  links and anything a sweep left undone when it hit its limits.

Running it twice is harmless: a role that is done is never picked up again.

## The three things this pass must not do

1. **Never reject and never change `stage`.** A deal-breaker fail is recorded and shown; the user decides.
   Screening roles out is the sweep's job, before a role exists, and only for the sweep's own finds.
2. **Never score Fun or Shot.** Leave `fun`, `shot`, `funUnsure` and `shotUnsure` as they are.
3. **Never research the company.** No company rows created or edited, no `priority`, no pay estimates.
   Read the company row when it exists and reuse its facts.

**Absence of data never fails a deal-breaker**, unless that rule's check note says otherwise. Unknown
passes, recorded as unknown.

## Budget

`profile/settings` `longlist`, defaults when missing:

| Setting | Default | Meaning |
| --- | --- | --- |
| `maxRoles` | 30 | Roles researched in one run |
| `maxFullPostings` | 20 | Postings fetched in one run (posting text already in hand doesn't count) |

When called from the sweep, every tool call also counts against the sweep's own `maxToolCalls`. A run that
hits a limit stops cleanly; the morning run picks up the rest. Newest roles first.

## 1. Pick up the roles

Every role with `stage: "proposed"` (the Longlist) and **no `llAt`**, except one with
`readState: "needs"` (the user has to fix the link first; it is picked up again once they do).

`llAt` is the done marker: the date this pass finished the role. Nothing else counts as done, not a rough
`fit`, not `highlights`.

## 2. Read pasted links first

Roles added by pasting links arrive with `readState: "waiting"`, a `url`, often a guessed
`title`/`company` (`titleGuess: true`), and sometimes `pasted`, the posting text the user copied in.

1. If `pasted` holds text, read the posting from that. It wins over any fetch.
2. Otherwise read the employer's own posting. **Never use a logged-in LinkedIn session** (it breaks
   LinkedIn's terms and risks the user's account). From a LinkedIn link take the title and company, find
   the same role on the employer's careers site, use that posting, set `url` to it, and keep the LinkedIn
   link in `sourceUrl`.
3. On success: fill `title`, `company`, `companyId` (slug of the name; check for an existing company row
   under that slug first), `location`, `office`, `salary`, `closing` (YYYY-MM-DD, only from the employer's
   own posting), `postingAge`; set `titleGuess: false` and `readState: "read"`.
4. On failure: add 1 to `readTries`. Flag only on the second failed run (a page can just be down), except a
   removed posting, which is flagged at once. To flag, set `readState: "needs"` and `readReason` to one of
   `login`, `gone`, `blocked`, `notfound` (LinkedIn-only, not on the employer's site).
   **Never research a role you could not read**: a picture built on a guessed title is worse than none.

## 2a. Pages that load the ad with JavaScript

This applies to **every** posting this pass fetches: pasted links, and sweep finds it reads in full.

Some careers sites (Oracle, Workday, SuccessFactors, iCIMS, SmartRecruiters) build the ad in the browser,
so a plain fetch returns a near-empty page: a cookie banner, a title, no responsibilities or requirements.
That is not a read. Never score Role Fit or check deal-breakers from it.

1. Read `refs/ats-endpoints` section 1c ("Reading one ad") once per run.
2. When a fetch comes back near-empty, match the link's host to a row there, build the feed address from the
   link exactly as the row says, and fetch that. If it carries the ad, it is the posting: carry on as a
   successful read. It never counts as proof the role is open (`linkChecked` rule below).
3. No row for the host, or the feed fails too: set `readState: "needs"`, `readReason: "nofeed"` and
   `readHost` (the link's host, e.g. `fa-evdq-saasfaprod1.fa.ocs.oraclecloud.com`). The board lists these in
   Data health under Job sites we can't read yet, and `next-role-fix` works out the site's pattern once.
   - A role whose title and company are real (a sweep find, or a pasted link with `titleGuess: false`):
     finish the rest of this pass from the listing — deal-breakers it can't confirm are `unknown`, Role Fit
     is rough — and set `llAt`.
   - A pasted link with a guessed title (`titleGuess: true`): research nothing and leave `llAt` unset.
   Don't add to `readTries` for `nofeed`: it isn't a page that might come back up.

When `next-role-fix` adds the site's pattern, it sets those roles back to `readState: "waiting"` and clears
`llAt`, so this pass picks them up again and reads them properly.

`linkChecked` follows the sweep's rule: only from the employer board's index of current openings
(`linkMethod: "index"`) or a real browser session. Never from a fetched page. Never clear it.

## 3. Deal-breakers

Check **every** rule in `profile/prefs` `hardRules`, whatever stage its `fires` names, using its `rule`
text and its `check` note. Company-basis rules (`basis: "company"`): decide once per company and reuse,
from the company row when one exists.

- Write each result to `enrich.gate2Rules` as `pass`, `fail` or `unknown`, and set
  `enrich.rulesFrom: "longlist"`. These are provisional: `next-role-shortlist` replaces them with its own.
- For a sweep find, a search-stage rule it survived is `pass` where the evidence was confirmed and `unknown`
  where the sweep let it through on missing data.
- **Each fail** also goes in `red` as `"<rule name> (<id>) — fails: <the fact, under 12 words>"`. Never
  remove a fail flag someone else wrote.
- Only the employer's own posting confirms a fact. Location, office pattern, salary or remote status taken
  from an alert, aggregator or newsletter can't pass a rule that depends on it: that rule is `unknown`.

## 4. Preferences, pluses and concerns

From `profile/prefs` `scored`: every preference **without** `stage: "shortlist"` (those are researched at
the Shortlist). Company-basis ones come from the company row when it exists.

- `highlights`: the three strongest bands not already shown as their own field, plus any weak band worth
  pinning, as `[{code, label, band: "strong"|"mid"|"weak"}]`. `label` is the fact behind the band, short.
  Nothing is totalled.
- `green` / `red`: a role-level fact that matches one of the user's pluses (`upside`) or concerns (`red`),
  written `"<title> — <detail>"`. Company-level flags stay on the company row; don't copy them.
- Only what the posting or listing shows. A preference you can't judge is left out, not guessed.

Merge with what is there: keep every existing `green`, `red` and `highlights` item the user or another
pass wrote, and don't add a second item for the same thing.

## 5. Role Fit

Score following the `next-role-role-fit` skill:
- **Proper** (`rough: false`, `basis: "posting"`) when the full posting was read, by this pass, by the
  sweep in the same session, or from `pasted`.
- **Rough** (`rough: true`, `basis: "snippet"`) when only the listing or alert is known.

The user's edits win, as that skill says. A proper score never gets replaced by a rough one.

## 6. Write it back

Merge into the role with `update`, pinned with `if_version`. Never replace the row. Fields this pass
writes: the read fields in steps 2 and 2a (`readState`, `readReason`, `readHost` included), `enrich.gate2Rules`, `enrich.rulesFrom`, `highlights`, `green`, `red`,
`fit`, and **`llAt: "<YYYY-MM-DD>"`** last. Every other field, including the rest of `enrich`, is left as
it is. Only when no company row exists, `sector` and `size` may go on the role as placeholders for the
shortlist pass. Never write `tier` or `priority` on a role.

Every text field follows `profile/brief`'s Keep it short rules.

## 7. Report, briefly

One line per role: `#N title, company — Role Fit band · pct% (rough|from the ad)`, then any deal-breaker
fail by name, else "no fails". Then: pasted links that couldn't be read (and why), roles flagged `nofeed` with their site
(Data health › Job sites we can't read yet), and roles left for the next run because of a limit. Nothing to do: one line saying so.

## Related

- `next-role-sweep` — finds roles, screens out deal-breaker fails, then calls this pass.
- `next-role-shortlist` — the deep research once the user sends a role on; replaces this pass's rules.
- `next-role-role-fit` — how Role Fit is scored.
- `next-role-daily-check` — runs first in the morning: open checks, folding, the fix queue.