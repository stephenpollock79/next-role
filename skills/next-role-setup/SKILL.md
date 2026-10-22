---
name: "next-role-setup"
description: "Does the heavy steps of a Next Role board's guided setup: proposes sectors and companies, recommends sources, runs the test sweep, sets up job alerts and creates the scheduled tasks. Use for a pasted \"Run next-role-setup\" request."
---

# Guided setup: the steps Claude does

The board's setup wizard does most steps in the page. Five need Claude with the web, the user's connections and
the other skills, so the wizard hands them over: the user presses **Copy for Claude** and pastes a request here.
It looks like:

```
Run next-role-setup on my Next Role board (https://claude.ai/artifact/…).
Setup step: companies (Companies)
Request: su-companies-mvjqmfrm
Work out the sectors that suit me, then propose up to 25 companies …
When it's done, mark the step on the board and tell me to go back to it.
```

The step is one of `companies`, `sources`, `testsweep`, `alerts`, `schedule`. The wizard is open on the board and
shows what this skill writes, live. **The user should never have to tell the board you've finished.**

**It sets up; it does not decide.** Never rate a company or sector, never change a role's stage, never score
Fun or Shot, never set a source Active. Suggestions go in the fields named below, for the user to confirm in
the wizard.

## Where everything lives

The board is the source of truth. Read and write it with the artifact database tool (`ArtifactData`). The
board's URL is the link in the pasted request; without one, the link in the project's instructions; if there
is none, ask for it.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, the words to use) | `profile/brief`: read it first; it binds every write |
| Who the user is: profession, location, `country`, `timezone`, `spelling` | `profile/me`, `profile/skills`, `templates/cv` (`text`) |
| What they want: deal-breakers, preferences, search terms | `profile/prefs` |
| Limits and switches, the Gmail label (`alerts.gmailLabel`), `board.kind` | `profile/settings` |
| Setup progress | `profile/onboarding` |
| Companies, sectors, channels, sources, sweep records | `companies`, `sectors`, `channels`, `sources`, `runs` |
| How to read each job site (ATS endpoints) | `refs/ats-endpoints` |

Every write to an existing document is an `update`, pinned with `if_version` (read it first). Write in the
user's spelling (`profile/me` `spelling`: UK or US English), plain words, no jargon.

**A test board** has `profile/settings` `board.kind: "test"`. On a test board, follow the "test board" line in
each step: some things are shown, not created.

## Marking the step: do this every time

Times are the real current time, in ISO with its time zone (read it from the system or a tool); never guess one.
If you can't tell the time, leave `startedAt` or `doneAt` out.

The wizard watches one field per step on `profile/onboarding`: `h_<step>` (for example `h_companies`). Write
only that field; never touch `status`, `step`, `drafts` or anything else on the document.

1. **Straight away, before any work:** read `profile/onboarding` and update
   `h_<step>: {status: "working", reqId: "<the Request id>", startedAt: "<ISO time now>"}`.
   The wizard switches to "Claude is working on this".
2. **When done:** update `h_<step>: {status: "done", reqId, startedAt, doneAt: "<ISO time>", summary: "<one line>"}`.
   The summary is one plain sentence under 140 characters with the numbers, e.g. "22 companies proposed
   across 5 sectors; 9 need a LinkedIn alert." The wizard shows it under **Complete**.
3. **If it can't be finished:** update `h_<step>: {status: "failed", reqId, startedAt, error: "<what went wrong, and what the user should do>"}`.
   Keep any work already written; say in `error` what's left.
4. **Your last message** says, in its first line: "Done. Go back to your board: <step name> shows complete and
   the next step is ready." (or, after a failure, what to do). Then a short report: what you added, anything
   that needs the user. Don't repeat the whole list; it's on the board.

If the request has no Request id (an old copy), still write `h_<step>`, without `reqId`.

## The steps

### `companies`: Companies

Read `profile/brief`, `profile/me`, `profile/prefs`, `profile/skills`, `templates/cv` `text`, and the existing
`sectors` and `companies`.

1. **Sectors.** Work out 3 to 8 sectors that suit their background and what they want, and use them to choose
   companies. For each new one write `sectors/<slug>`: `{name, priority: "unrated", createdVia: "setup", createdAt: <today>}`.
   The wizard only lists them ("Claude looked in: …"); the person doesn't rate sectors at setup. Leave existing
   sectors alone.
2. **Companies.** Propose **up to 25** companies they would plausibly want, best fits first, spread across those
   sectors and their location (or remote reach), mixing well-known names with good smaller ones. The person has to
   rate every one, so fewer, better picks beat a long list; others reach the board later through roles. Include
   every company already on the board with `createdVia: "setup"` (ones the user typed in). For each new company write
   `companies/<slug>`: `{name, sector, priority: "unrated", listing: "target", watch: false, setupSuggest: {rating, why},
   createdVia: "setup", addedAt: <today>, notes: [], red: [], green: [], questions: []}`. Skip a company already
   on the board under any slug or spelling. Never write `priority`: the user rates every company in the wizard.
3. **Suggested rating.** `rating` is `high`, `medium`, `low` or `off`. Suggest `off` only when there is evidence
   it fails one of their deal-breakers, and name the rule in words in `why` ("only hires in London three days
   a week: fails your office-days rule"). Otherwise `why` says in one line why it's on the list, and what the
   company does if it isn't a household name.
4. **Research each company, lightly** (one or two searches each): its own jobs page and how it can be read,
   following `next-role-daily-check`'s method for finding a new company's job board and `refs/ats-endpoints`
   (write `boardUrl` and `boardAts`; when the board can't be fetched, `boardNeedsAlert: true`), and how many
   office days it asks for (`officeDays` as a number, `officeNote` with where you read it). Unknown office days
   are fine: leave the field out rather than guess. **The jobs page is not optional:** every company ends with
   either `boardUrl` and `boardAts`, or `boardNeedsAlert: true` with a `boardNote` saying why. If you found one of
   its ads on an ATS (Greenhouse, Lever, Ashby…), that ATS board is its jobs page. Before marking the step done,
   check every company has one or the other (or the note in point 5).
5. If time runs short, finish writing the companies first. Any company whose jobs page you couldn't check gets
   `boardNote: "Not checked in setup"`; the next morning run's daily check looks again. Say how many in the summary.

Summary: "<n> companies proposed across <m> sectors; <k> need a LinkedIn alert."

### `sources`: Where roles come from

Read `profile/me` (country, location, profession, level), `profile/prefs` `searchTerms`, `channels`,
`sources` and `refs/ats-endpoints`.

The board already has the standard channels (made when it was first opened): `alerts` (Alert emails), `boards`
(Public boards), `companies` (Company careers pages), `careers` (Careers-site search), `flags` (Flag searches),
`recruiters` (Recruiters), `manual` (Sites I check), `warm` (Warm routes), `aggregators` (Other job sites). Put
sources into those; create a channel only if one of them is missing, with the same id. Never edit a channel's
`how`: the sweep reads it as instructions.

1. **Job sites:** 6 to 12 that suit their field, level and country: the main job boards, specialist boards for
   their field, communities with job channels, and LinkedIn. Prefer sites that list the level they want.
2. **Recruiters:** 2 to 5 recruitment agencies that place their kind of role in their area (or remotely), each with
   its vacancies page. Channel `recruiters`.
3. **Careers-site search:** one source per job-ad system the sweep searches for companies not on their list:
   Greenhouse, Ashby, Lever, Workable, Recruitee, Teamtailor, Personio (name, and the system's jobs domain as `url`).
   Channel `careers`; check `refs/ats-endpoints` for the right domains.
4. **How each job site is read**, in `setup.read`:
   - `read`: public pages or feeds the sweep can fetch (channel `boards`);
   - `alerts`: needs a login or blocks automated reading, **and the site offers email job alerts** (check that it
     does); the sweep reads the alert emails (channel `alerts`);
   - `manual`: can't be read and has no usable alerts, so the person checks it by hand (channel `manual`).
   Recruiters and careers-site search sources are `read`.
5. Write each source as `sources/<slug>`: `{name, url, channelId, status: "trial", why: "<one line>", order,
   setup: {read, why: "<one line>"}, createdVia: "setup"}`. Never change an existing source's status; the person
   chooses Active, Trial or Not now in the wizard.

Summary: "<n> sources added: <a> read automatically, <b> through alert emails, <c> to check by hand, <d> recruiters."

### `testsweep`: Test sweep

Run `next-role-sweep` once, in full, following that skill exactly (it reads its own rules, writes the longlist,
the screen-outs and the run record, then runs the longlist research). This is the user's first sweep; tell it
so it doesn't treat an empty history as a problem. **Test board:** read the alert emails only.

Then read the run record it wrote and summarise: listings read, roles added to the longlist, screened out,
and sources that came back empty or blocked. For each blocked or login-only source, update its `setup.read` to
`alerts` and its `channelId` to `alerts` if the site offers email job alerts (so the Job alerts step picks it up),
otherwise to `manual`.

Summary: "Read <n> listings from <m> sources: <k> on your longlist, <x> screened out; <y> sources blocked or empty."

### `alerts`: Job alerts

The board does the person's part before the request is pasted: a checklist of the sites to sign up to, which they
tick once signed up and signed in (`profile/onboarding` `alertsReady`, keyed by source id; `linkedin` for LinkedIn).
**Don't wait for them in the chat, and don't ask them to sign up there.** The board shows each site's progress
from what you write.

**Progress, site by site.** Keep `h_alerts.sites` up to date as you go: an array of
`{id, name, status, note}`, one per site, where `id` is the source id (`linkedin` for LinkedIn) and `status` is
`working`, `done` (alerts created), `had` (alerts already arriving; nothing created), `signin` (not signed in;
skipped), `failed` (can't be done; say why in `note`) or `planned` (test board). `note` is one short line, e.g.
"3 role searches, 4 company alerts". Each update rewrites the whole `h_alerts` object with `status: "working"`,
`reqId` and `startedAt` kept, so read it first and pin it.

**Only some sites.** If the request says "Only these sites this time", do only those, and keep the other entries
in `h_alerts.sites` as they were.

**Test board: a dry run.** Don't sign up, open the browser to change anything, create alerts, or change Gmail
(no filters, no labels; reading it is fine). Read the board and do point 1, then list site by site the alerts and the
filter you would create, with each site's status `planned` (or `had`). Mark it done with the summary "Dry run: <n>
alerts and a filter for <k> senders listed."

Needs Gmail connected to Claude, and Claude in Chrome for the sites (read the browser's skill first). If Gmail
isn't connected, mark the step failed: "Gmail isn't connected to Claude. Connect it in Settings › Connectors,
then copy the request again." Without a browser, mark the step failed: "Claude in Chrome isn't available in that
chat. Open a chat where it is, then copy the request again." Alerts go to the Gmail account connected to Claude.
The board never stores their email address.

1. **What's already there:** search Gmail (the label in `profile/settings` `alerts.gmailLabel`, then the inbox)
   for job alerts from the last month. List what already arrives, by site and search, and don't make those again.
2. **The list** (the same sites, in the same order, as the board's checklist):
   - **LinkedIn job alerts by role, always, first.** One alert per search term in `profile/prefs` `searchTerms`
     (title or role words), daily, by email, for the places their where-they-work rule in `profile/prefs`
     `hardRules` (type `location`) lets through: their area if it allows office or hybrid work there, remote in
     their country if it allows remote, or both. Never add remote, or their area, if the rule rules it out. If
     there's no LinkedIn source, add one: `sources/linkedin`, channel `alerts`, `setup.read: "alerts"`, status
     `trial`. It's usually the biggest source.
   - Sources with `setup.read: "alerts"` or channel `alerts` (and not `dropped`): saved searches from the same
     search terms and places.
   - Companies rated Want it or Would consider with `boardNeedsAlert: true`: a LinkedIn company alert each.
3. **Site by site, in their signed-in Chrome:** open the site. If it isn't signed in, mark it `signin` and move
   on; never create accounts or type passwords. Otherwise create the saved searches, as often as the site allows,
   and mark it `done`. LinkedIn company alerts: follow `next-role-fix`'s `linkedin-alert` kind, and mark each company
   as that kind says.
4. **The Gmail filter:** one filter that labels every alert sender with the label in `profile/settings`
   `alerts.gmailLabel` and skips the inbox. If you can't create the filter, give exact steps: Gmail › Settings ›
   Filters and blocked addresses › Create a new filter, From: the senders joined with OR, then Skip the inbox and
   Apply the label. Add each new sender to it.
5. Each source stays `trial` until its first alert lands. On each source marked `done`, write
   `setup.alertSetAt: <today>`; on each marked `had`, write `setup.firstAlertAt: <date of the latest alert email
   you found>` (alerts already arriving are already working). The sweep writes `firstAlertAt` for the rest when
   their first email arrives; one with no email after 7 days shows in Data health. Don't write either on a test board.
6. Mark the step done even if some sites are `signin`: the board shows those with a button to copy a request for
   just them. Say how many in the summary.

Summary: "Alerts set up: <r> LinkedIn role searches, <n> sites, <m> companies; <s> need you to sign in."

### `schedule`: Scheduled tasks

Read `profile/onboarding` `schedTasks`: the four tasks the board saved when the person pressed Save, each
`{name, when, connectors, prompt}`. Create one scheduled task per entry, each a fresh session, with that `name`, that
`prompt` copied exactly (it carries the board link and the run records Data health reads; never shorten or rewrite
it), on the schedule in `when` in the time zone it names (`profile/me` `timezone`). If a task with the same name
already exists, update it rather than making a second. If `schedTasks` is missing (an older board), use the days
and times in the request and these prompts, with `<board link>` from `profile/settings` `board.url`:

| Task | Prompt |
| --- | --- |
| Next Role sweep | `Run next-role-sweep on my Next Role board (<board link>).` |
| Next Role morning, part 1 | `Run next-role-daily-check, then next-role-longlist-research, on my Next Role board (<board link>).` |
| Next Role morning, part 2 (45 minutes after part 1) | `Run next-role-shortlist, then next-role-apply-pack, then next-role-interview-prep, on my Next Role board (<board link>).` |
| Next Role screen-out check | `Run next-role-sweep-check on my Next Role board (<board link>).` |

Attach only the connectors a task needs (`connectors`): Gmail on the sweep, nothing else on any of them. Use the
scheduling tools available in this chat; if there are none, mark the step failed with "Scheduled tasks can't
be created from this chat. Use I'll set them up myself on the board: it shows each task's prompt to copy."

**The sweep's model.** If the request says the person wants the sweep on Sonnet (or `schedTasks`' sweep entry has
`model: "sonnet"`), that is their own request to change the task's model: once the sweep task exists, change its
model with the scheduling tool's model setting to the newest Sonnet model the account offers (e.g.
`claude-sonnet-5-5`). The other three tasks keep the default. Record what each task ended up on (below).

**Approval on each run.** Don't set the task's approval setting yourself; leave it for the server to choose. Each
creation result says which setting the task got (`permission_mode`): `auto` means its runs go ahead on their own;
anything else means a run stops and waits whenever it needs approval. Write
`h_schedule.tasks: [{name, auto: true|false, model: "<model ID the task runs on>"}]`, one per task, from those results.
If you couldn't move the sweep to Sonnet, its `model` says what it's on, and the board asks the person to change it. The board then shows the person,
straight away, which tasks need **Automatically approve** turned on in their settings, and keeps Continue shut until
they confirm. Say the same in one line of your last message, naming the tasks; never promise a setting the
results didn't confirm.

**Test board:** show the four tasks with their prompts and times, but don't create them; mark the step done
with the summary "Shown only: this is a test board."

Summary: "Four scheduled tasks created: sweep <days> at <time>, morning run at <time>, screen-out check <day>."