---
name: "next-role-sweep"
description: "Job sweep for a Next Role board: reads the job-alert emails and public boards, applies the deal-breakers, writes survivors to the longlist, then runs the longlist research on them. Run by a scheduled task, or \"run the job sweep\"."
---

# Job sweep

The sourcing pass for the job search. It builds the longlist; it decides nothing.

## Where everything lives

**The board is the source of truth for everything this pass reads and writes.** Nothing comes from
this file except how to do the work. Read and write the board with the artifact database tool
(`ArtifactData`). The board's URL comes from the scheduled task's prompt or the project's
instructions; if neither gives one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use) | `profile/brief` — read it first, every run; it binds every write |
| Deal-breakers, preferences, search terms, pluses, concerns, role shape | `profile/prefs` — read it live every run, never from a remembered copy |
| Limits and switches (budget, alert label, unnamed-employer adverts, listing age) | `profile/settings` — read every run; a missing value means use the default below |
| Channels and sources | `channels`, `sources` — run only `status` `active` or `trial` |
| Companies | `companies` — `priority` (the user's rating), `listing`, `watchWhy`, `red`, `warm`, `boardAts`, `boardUrl`, `boardSeen`, `boardNeedsAlert`, `officeDays`, `officeNote` |
| Sector ratings | `priority` on each `sectors` record |
| ATS endpoints | `refs/ats-endpoints` |
| Roles, run log, screened-out log | `roles`, `runs`, `screened` |
| Turned-down roles already folded away | `refs/rejected-keys` — read once per run, before step 7 |

A source's `note` says how to read it (quirks, senders, what to ignore). A deal-breaker's `check` note
says how to test it. **Both win over anything general in this skill.** A fix to how a source is read or
a rule is caught belongs in that note on the board, never here.

**Empty or new board.** If `profile/prefs` has no deal-breakers and no search terms, or there are no
active channels, write a `runs` document (`type: "sweep"`, `found: 0`, note "Board not set up: <what is
missing>") and stop. Missing companies or sources are not a reason to stop; run what exists.

## The three things this pass must not do

1. **Never argue fit.** Write neutral facts and the gaps. A model asked for a case always finds one.
2. **Never reject on judgement.** Only a deal-breaker removes a role, and only where the evidence
   exists. A false positive costs a minute on the longlist; a false negative is never seen.
3. **Never score Fun or Shot.** They are the user's, by hand, on the longlist.

## Budget

Read the limits from `profile/settings` `sweep`. Defaults when a value is missing:

| Setting | Default | Meaning |
| --- | --- | --- |
| `maxToolCalls` | 350 | Every tool call in the run, helper agents included |
| `maxSubagents` | 2 | Helper agents in the whole run; none may start its own |
| `maxWebSearches` | 12 | Across the title, domain and upside-flag searches together. Searches made in step 5 to find a survivor's employer posting don't count here |
| `maxFullPostings` | 40 | Full postings read, to settle office days, location, pay and whether the role is open |

Fixed limits: **one fetch per company board, no retries** (a failure goes in `endpointFails`);
**never search for a company's board for sourcing** (in step 4 a company with no `boardUrl` is skipped
and named in the run note; the daily check finds boards). The one exception is step 5: a survivor's own
posting may be looked up on its employer's board, found by search if need be (see "Read the ad on the
employer's own site"). **Never fetch a board with `boardAts: linkedin-alert` or `boardNeedsAlert: true`**
for sourcing (its roles arrive by email); reading one survivor's posting there is allowed.

**A sweep that hits a limit stops, writes `screened` and `runs`, and reports a partial run.** That is a
correct outcome. Work in this order so the budget runs out on the cheapest work to skip: alert inbox,
boards with a recorded endpoint, searches.

**Keep a third of `maxToolCalls` for checking.** Once two-thirds are spent, stop reading new sources and
move to step 5 (checking survivors and reading postings), then write. A run that finds a lot and checks
none of it hands all the checking to the user.

Measure honestly: `toolCalls` and `subagents` counted, `minutes` from the first and last timestamps.

## 1. Read the criteria

From `profile/prefs`: `hardRules` (id, name, fires, rule, `check`, `firm`, `basis`), `scored` (id, name,
bands, `basis`, `stage`), `upside`, `red`, `roleShape`, `searchTerms`. Note `prefs.version` for the run log.

**`basis`** says what a rule or preference is about. `company`: decide it once per company and reuse it
for every role there (from the company row when one exists). `role`: decide it per role. Blank: decide
from the name.

## 2. Read the alert inbox first

Gmail, label from `profile/settings` `alerts.gmailLabel` (default `Job Alerts`), `after:` the date of
the last `runs` document with `type: "sweep"`; with no earlier sweep, the last 7 days. Never the whole
label, and don't rely on unread state. If the Gmail tools aren't loaded, load them with ToolSearch; if
that fails, hand this step to one helper agent.

Which sources send alerts, and from which address, is in each `alerts` source's `note`. Ignore mail
from a sender that carries no listings.

**Alerts from a site that isn't a source yet.** When alert emails come from a job site or service with no
`sources` row (no source's `note`, name or URL matches the sender), add one before writing its roles:
`sources/<site-slug>` `{name, url: "<the site's home page>", channelId: "alerts", status: "trial", why: "Found in your
alert emails", note: "Sender: <address>", order, setup: {read: "alerts", firstAlertAt: <the earliest email's date>},
createdVia: "sweep", addedAt: <today>}`. Use that id as the roles' `sourceId`, never a made-up one. Name each new
source in the report. Skip senders that carry no listings.

**First alert from a new source.** When you read an alert email from a source whose `setup.alertSetAt` is set
but `setup.firstAlertAt` is not, update that source with `setup.firstAlertAt: <the email's date>` (an `update`
pinned with `if_version`; keep the rest of `setup`). The board then shows its alerts as working; one with no email
7 days after `alertSetAt` shows in Data health as an alert that never arrived. Match the email to the source by
sender or site name.

**Dedupe is the main work here.** Saved searches overlap by design and one role can arrive in several
emails. Merge onto the existing `roles` document; never create a second.

An alert gives title, company, location and often salary: enough for the search-stage rules. It does
not prove the role is open, and its links are usually tracking redirects. Verify in step 5.

## 3. Run every automatic channel

Run every channel with `kind: "auto"` and `status` `active` or `trial`. Channels with `kind: "manual"`
are the user's to check. A channel's `how`, and its sources' `note`s, say how to read it. Steps 2 to 4
cover the usual ones: alert emails, public boards and recruiters (fetch each active source),
company careers pages, and searches (titles, domains, upside flags, careers-site search). A channel
whose `how` says it is only reached through searches gets no run of its own.

Respect robots.txt: where the best filtered view is disallowed, take the coarser page and filter
locally.

**Recruiter adverts that don't name the employer:** `profile/settings` `roles.unnamedEmployerAdverts`
(default `include`). When `include`, write them as normal longlist rows with
`company: "Employer unknown (via <recruiter>)"`, `companyId: ""`, `employerUnknown: true`, and the red
flag *"Employer not named — ask the recruiter (<name>) who it is"*. Apply the rules the advert's own
facts can test; company rules stay unknown, and unknown passes. Id `unknown-<recruiter>-<title-slug>`.
Dedupe on the advert URL: the same advert is reposted across sites. When `skip`, log them in
`screened` as `employer not named`.

## 4. Search: titles, domains, upside flags, company boards

**Every term comes from `prefs.searchTerms`**, never from this file.

- **Title searches:** every term in the titles group, at equal weight.
- **Domain searches:** every term in the domain group, each as its own query.
- **Upside-flag searches:** one narrow search per term in the upside-flag group.
- **Careers-site search**, when that channel is active: site-scoped searches as its `how` says.
- Stay within `maxWebSearches` across all of these: pick the strongest terms rather than every variant.
- A search result is only a find when it links to one role. A page of listings is not; use it only if
  it leads to a single role's page within the budget.
- Narrow the queries, not the rules. A sourcing miss is fixed by adding a query; a filtering miss is silent.

**Company boards: the rating decides how often** (since 5 Oct). The user's rating (`priority`) is the
only thing that decides whether and how often this pass fetches a company's own job board. **Only Want it
and Would consider are fetched**, so the list of fetched boards only grows when the user decides it should.
`watch` is kept in step by the board for older readers; don't decide from it. Never infer or write a
priority: it is the user's field, and `unrated` is normal.

| Rating (`priority`) | Board fetched |
| --- | --- |
| `high` (Want it) | Every sweep |
| `medium` (Would consider) | Once a week: only when `boardSeen` is empty or 6 or more days old |
| `unrated` | Never, until the user rates it. Its roles reach the longlist only through alerts and searches |
| `low` (If it appears) | Never. Its roles reach the longlist only through alerts and searches |

Fetch them in that order (high, then medium, oldest `boardSeen` first), within the budget. A company due
this run but skipped for budget is named in the run note; it is due again next run.

**Ruled out:** `listing` `excluded`, `defunct` or `rejected` means the user has ruled the company out (the
board says "Ruled out"; never say "off the list"). Never fetch its board, and **a role at a ruled-out company
from any source** (alert, board, search) is not written: log it in `screened` with rule `company ruled out`.
Match a find to a company by `companyId`, or by the company name slugged; a ruled-out card may be bare
(`createdVia: "rejection"`, no research), and that is enough to screen. Every other `listing` value
(`target`, `queue`, `ruling`, `offlist`) is not ruled out and follows the rating table.

A concern about a company (office days, no product roles in this country) is a red flag on its row,
never a reason to stop watching it. Read `watchWhy` and `red` for judgement.

**How to read a company board cheaply.** Use the ATS JSON endpoint from `refs/ats-endpoints`, not the
HTML careers page, and never ask for descriptions in the list call (on Greenhouse, no `?content=true`).
Each company row keeps `boardAts`, `boardUrl`, `boardCount`, `boardLatest` (newest publish date seen)
and `boardSeen`. **If `boardLatest` hasn't moved and `boardCount` is unchanged, record `boardSeen` and
move on.** A changed count always means read the list.

**Apply every search-stage rule to every source, careers pages included.** A full careers board isn't
pre-filtered like an alert, so a large employer lists every office it has.

**Not roles:** an evergreen talent-pool page (always open, no team or scope) is logged in `screened` as
`talent pool`. A role with no page of its own (a careers search page, a board's front page) is logged
as `no role link`. `url` must be the employer's page for that one role.

## 5. Verify every survivor

**A text fetch of a job page is not a liveness check.** Closed postings often still serve the full
description under a "no longer active" banner, or redirect to the board with an application form that
belongs to the board. Liveness is established only by:

1. **the employer board's index of current openings** (the role is listed), or
2. **a real browser session** that saw the page with no closed banner or redirect.

With every `linkChecked` date write `linkMethod`: `"index"` (and which ATS) or `"browser"`. Never write
`linkChecked` from a fetch: leave both blank instead. Don't overturn an earlier closed-finding without
browser evidence.

**Aggregator and search-engine finds:** find the employer's own board and check its index.
- Reached it and the role isn't listed → don't write it; log in `screened` as `gone from employer board`
  with both URLs.
- Couldn't reach it (no board, browser-only site, a block or login) → write it with `liveCheck: "you"`
  and the red flag *"Check it's live — couldn't reach <company>'s job board"*.
- Listed → set `url` to the employer's posting; keep the aggregator link as `sourceId`.

Roles from `boardAts: linkedin-alert` companies arrive with `linkChecked: ""` and `liveCheck: "you"`.

**A fetch can prove a role closed, never open.** When a fetched posting says the role is closed ("no
longer accepting applications", "this position has been filled", "job not found"), log it in `screened`
as `closed` and don't write it. For alert finds, read the posting as below.

**Stale listings:** a job-board or aggregator listing older than `profile/settings`
`roles.maxListingAgeDays` (default 45) is logged in `screened` as `stale listing` unless the employer's
own board shows the role open.

**An unconfirmed fact never passes any rule and earns nothing.** Location, office pattern, salary or
remote status taken from an alert, aggregator or newsletter is written as unconfirmed
(`"United Kingdom (Remote) — per <source>, unconfirmed"`): no green flag, no strong band, no pass on a
rule that depends on it. The employer's own posting confirms it; then drop the "per" wording.

**Read the full posting of every survivor whose listing doesn't settle a rule**: a location that doesn't
say where or how often the person works, "Remote" with no country, no salary where pay decides a rule,
or anything a rule's check note asks for. Work through them within `maxFullPostings`, best fits first.
What a check note says about an unsettled fact (for example, that a bare city outside the commute range
fails) decides survivors you can't read. A posting that can't be read in full gets `office: "not read"`
and the "Check it's live" treatment. When a posting states office days for a company with no
`officeDays`, add them to the company row.

### Read the ad on the employer's own site (added 11 Oct)

Most survivors arrive from LinkedIn alerts or aggregators whose pages can't be read. **Never fetch a
`linkedin.com` link**: robots.txt blocks every one, so the call is always wasted. Never use a logged-in
LinkedIn session or a browser. Instead, find the same role on the employer's own site and read it there.
A test on 11 Oct found the employer's ad for about 6 in 10 alert rows this way, most with office pattern
and many with pay.

For each survivor that needs its posting read, at most **3 calls**, then move on:

1. **The company row has `boardAts` and `boardUrl`:** read the board's index from `refs/ats-endpoints`
   (no descriptions in the list call), match the role, then fetch that one job. A match in the index is
   also a liveness check (`linkMethod: "index"`).
2. **No board recorded:** one web search for the role on its employer's site (`"<company>" "<title>"`,
   or scoped to the common ATS hosts: greenhouse.io, lever.co, ashbyhq.com, workable.com, teamtailor.com,
   breezy.hr, myworkdayjobs.com, and the company's own careers domain). Then read the posting.
3. **Recruiter adverts** (`employerUnknown`): look for the advert on the recruiter's own website instead.
   Recruiter sites often state pay and office days that the alert leaves out.
4. **Jobgether, Himalayas and other readable aggregators:** read the aggregator page first. It is often
   readable and states pay. Still look for the employer's posting if the aggregator leaves a rule unsettled.

Where each ATS gives the most for one call:

| ATS | Read with | Notes |
| --- | --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/<board>/jobs/<id>` | The board name can differ from the company name (Plata's is `platacard`). Take it from a `gh_jid` or `job-boards` link |
| Lever | `api.lever.co/v0/postings/<company>/<id>` (`api.eu.lever.co` for EU boards) | The full ad, including salary when posted |
| Ashby | `api.ashbyhq.com/posting-api/job-board/<company>?includeCompensation=true` | Ashby job pages only load with JavaScript, so always use this API |
| Workday | The job page itself, one try | Often errors. On a failure, leave the role unread |

**Match carefully.** Use the employer's posting only when the title matches, or differs only by level
wording or team, **and** the location fits. A retitled or multi-city posting that may be the same seat
counts only when the team or product words match. Otherwise leave the role unread rather than take
another role's facts.

**When found:**
- Its facts are confirmed: drop the "per <source>, unconfirmed" wording.
- Write `pay` (`source: "The ad"`), `salary`, `office`, `closing` and the contract type.
- Set `url` to the employer's posting and keep the alert link as `sourceId`.
- If the company row has no `boardAts`/`boardUrl`, write them there so later sweeps go straight to step 1.
  This pass still never creates company rows.

**When not found** within the 3 calls: `office: "not read"` and the "Check it's live" red flag as before.
Name how many survivors were read this way, and how many weren't, in the run note.

Reading one survivor's posting is not a board fetch for sourcing. It doesn't change the rating table in
step 4, and other roles seen on that board are not added.

## 6. Apply the deal-breakers

- Apply each rule at the stage its `fires` says, and as early as the evidence exists, using its `rule`
  text and its `check` note.
- **Absence of data never fails a rule**, unless that rule's check note says otherwise. Unknown passes,
  tagged unknown.
- Company-basis rules: decide once per company and reuse.
- **A screened-out role is recorded, never deleted, and never gets a `roles` row.** It goes in this run's
  `screened` document (step 8).
- **The sweep's own finds only.** A role the user added is never screened out; its fails are recorded
  by `next-role-longlist-research` instead.
- **Near misses:** set `near: true` and say why in `saw` when a rule only just caught a role or may not
  really apply (pay a little under the bar, office days one over, a title one word off, a location
  wording that may still include the user).

## 7. Write the rows

Read `companies` before writing. If a company row exists, inherit its sector, size, priority and
warm route and write none of them onto the role. **This pass never creates company rows.**

**Highlights, flags and Role Fit are not written here.** `next-role-longlist-research` writes them in
step 9, the same way for every Longlist role however it arrived. This step writes the listing facts and
the green or red flags the verification itself turned up (e.g. "Check it's live").

The warm route is a company fact (`warm`, `warmNote`, and `people`). The role carries `referral`, what has
happened on this seat. Only when no company row exists, write `sector`, `size` and `warm` on the role as
placeholders for the shortlist pass. Never write `tier` or `priority` on a role.

Every text field follows `profile/brief`'s Keep it short rules.

One document per role in `roles`, id `<company-slug>-<title-slug>`. Dedupe on URL, or company plus
title, and merge rather than create a second row.

**Never bring back a role the user turned down.** Before writing any find, compare it with two places,
using the key rules in `refs/rejected-keys` `keyRules` (URL as host + path, lowercase, no `www`, query or
trailing slash, LinkedIn as `linkedin:<job id>`; company and title lowercased, `&` as "and", everything
that isn't a letter or digit as one space):

1. **`refs/rejected-keys` `items`** (folded rejections): a match on `urlKey`, or on `companyKey` plus
   `titleKey`, is not written. For `employerUnknown` adverts match on `urlKey` only.
2. **Existing `roles` rows** at `g1_rejected` or `g2_rejected` with `endBy` `me` or `them`: a match on URL,
   or company plus title, is not merged and not written. A row the employer pulled or filled (`endBy`
   `neither`) is not a turn-down: a live advert for it may mean the role reopened, so treat it as an
   ordinary match (merge listing facts only, never the stage) and name it in the report.

Log each one in this run's `screened` document with rule `turned down before` and `saw`
"<reason> on <date> (<where it matched>)". A repost under a new title or URL is not caught by this and
is written as normal; that is fine.

**Possibly the same seat: tag it, never skip it.** A find that passes everything above may still be a role
already on the board under another title or link (a LinkedIn advert and the employer's own board, a retitle).
Compare each new find with every `roles` row at the same company (same `companyId`, or the same company
name once lowercased) at any stage, and with `refs/rejected-keys` entries for that company. It is a likely
same seat when:

- the titles share a team or product word beyond the level and "product manager" (Panel, Payments, Growth,
  Loyalty, a product name), **and**
- the location matches (same city or same remote region) **or** the publish dates are within 7 days of each
  other (the row's `seen` or `postingAge`; the entry's `seen` or `postingAge`).

Then still write the find, with `maybeSameAs` set: the matched row's id, or for a folded entry
`"folded:<its urlKey>"` plus `sameAsNote: {title, company, by, reason, at}` copied from the entry. Pick the
closest match if there are several. Don't add a red flag for it: the board shows a ! on the row and asks the
user in Data health. Skip the tag when the new find's `notSameAs` already lists that id or key, and never tag
a match against a role the user added (`source: "self"`); the `maybeSameAs` rule for those is below. Name
every tagged pair in the report.

**A merge never changes a row's decisions.** When a find matches a row at any other stage, merge only
listing facts that are blank or newer (`url` when the old one is closed, `closing`, `salary`, `postingAge`,
`linkChecked` with its method). Never write `stage`, `fun`, `shot`, `funUnsure`, `shotUnsure`, any `end*`
field, `g1At`, `g2At`, `llAt`, `enrich`, `fit`, `referral` or `source` onto an existing row: the template
below is for new rows only.

**Roles the user added** (`source: "self"`): never merge into or edit them. When an advert matches one on
company and a similar title, write the advert as its own row with `maybeSameAs: "<that id>"`, unless
that row's `notSameAs` already lists the advert. Name every possible match in the report.

```
title, company, companyId,
url, source: "agent", seen: "<YYYY-MM-DD>",
channelId, sourceId,            // required: channel doc id; sources doc id, or co:<companyId>, or flag:<term-slug>
searchTerm: "",                 // the prefs search term that surfaced it, exactly as listed; "" otherwise
stage: "proposed",
location, office, salary, closing, postingAge,
pay: { base: {value, kind: "stated", source: "The ad"} },   // only when the ad states pay; never estimate
referral: "",
green: [], red: [],
fun: null, shot: null,
enrich: {},                     // highlights, fit, enrich.gate2Rules and llAt come from step 9
maybeSameAs: ""
```

A role found through several sources records the first. An alert naming a watched company is still
the alert's source, not `co:<company>`.

## 8. Log the run

Always write a `runs` document, including on a zero: "nothing new" and "the run broke" must look
different.

```
runs/<id>
  type: "sweep",            // "verify" for a pass that only re-checks existing rows; it never writes found or proposed
  date, prefsVersion, channels, found, out, proposed, note,
  sources: [ { id, name, read, passed, found, status: "ok"|"empty"|"blocked"|"error", note } ],   // every source tried, even empty ones
  companiesChecked, boardsMoved, boardsSkipped, boardsNotDue, atsJson, atsHtml, endpointFails,
  minutes, toolCalls, subagents,
  partial: false            // true when a limit stopped the run; say which in note
```

**Per-source counts keep "read nothing" apart from "nothing fits".** The board checks them separately:
Data health flags a source that read nothing for two sweeps (a fault), and Highlights flags one that read
listings but passed none for four sweeps (a keep-or-drop decision for the user).
- `read`: listings read from that source this run (board rows, alert-email listings, recruiter jobs), before
  any rule. For a board, the listings on the pages fetched; for alerts, the listings in the emails read.
- `passed`: how many of them reached the longlist (or were matched to a role already on the board as the
  same seat — count those in the note, not here).
- `found`: always equal to `read` (older board code reads it).
- `status: "ok"` only when the source was actually read and returned listings. Not read this run (not due,
  skipped for budget, unchanged) is `"empty"` with the reason in `note`; no alert email since the last
  sweep is `"empty"`, note "No email since last sweep"; a fetch that failed or was refused is `"error"` or
  `"blocked"`. Never `"ok"` with `read: 0`.
- `note` always says what happened to what was read, e.g. "20 read, 0 new; all office-based or US" or
  "19 read, 2 to longlist".

The note names the rule that removed the most, or why the zero. Never suggest loosening a rule with
`firm: "fixed"`: a large count there is a sourcing problem. Suggest loosening a `firm` rule only when the
user's spot-checks (`rulechecks`) show it removed roles they wanted.

One `screened` document per sweep, id matching the run:

```
screened/<run id>
  date, runId, count,
  rules: { "<rule id>": n },     // always written, kept forever
  items: [ { title, company, url, rule, saw, source, term, near } ]   // may be trimmed near the 256 KiB limit, near misses kept last
```

About 1,500 items fit one document; beyond that, split by channel with a suffixed id. Never delete a
`screened` document. To prune, merge old ones into a monthly document keeping `rules`, dropping `items`.

## 9. Research the new rows

Last, run the `next-role-longlist-research` skill, following it exactly, on the roles this run wrote.
Hand it the posting text you already read in step 5, so nothing is fetched twice. Its tool calls count
against this run's `maxToolCalls`; when the budget runs out, stop: the morning run finishes the rest.
The run log in step 8 is already written, so a research pass cut short never loses the sweep's record.
Count its tool calls in `toolCalls` by updating the run doc (pinned) once it's done.

## 10. Report in chat, briefly

Cost first: boards checked (every-sweep and weekly), moved, skipped as unchanged, skipped as not due
this week, JSON vs HTML, endpoint failures, tool calls against the limit, and survivors whose ad was read
on the employer's or recruiter's site against those left unread. Then found, removed per rule (named, not numbered), turned down before (count), reached the longlist, possible
duplicates of roles the user added, possibly the same seat (each pair), and any sourcing gap. Then the longlist research's own report.

If the batch is thin, name the three possible causes (thin flow, tight criteria, wrong channels)
without picking one. If nothing met a top band and you included the next band down, say so.

## Related

- `next-role-daily-check` — checks longlist roles stay open, folds old rejections (recording their keys in `refs/rejected-keys`), finds job boards for new companies.
- `next-role-shortlist` — researches roles the user shortlists; the only skill that creates company rows (the board itself makes a bare ruled-out card when the user rules out a company that has none).
- `next-role-longlist-research` — writes highlights, flags, deal-breaker results and Role Fit on the rows
  this pass writes (step 9).