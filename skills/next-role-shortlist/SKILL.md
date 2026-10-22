---
name: "next-role-shortlist"
description: "Shortlist desk research for a Next Role board: researches roles the user sent to the Shortlist (or added there) and their companies. Never decides or scores. Run by the morning task after the longlist research, or \"run the shortlist\"."
---

# Shortlist — the desk research pass

Turns a shortlist decision into a row worth reading. **It researches; it does not decide.** Go or no-go,
Fun, Shot and the decision to apply are all the user's, made on the board.

**Company facts live once, on the company row; role rows carry only what is true of that seat.** So the
second role at a company costs a fraction of the first, and rejecting a role never loses the company
research.

## Where everything lives

**The board is the source of truth.** Read and write it with the artifact database tool (`ArtifactData`).
The board's URL comes from the scheduled task's prompt or the project's instructions; if neither gives
one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use) | `profile/brief` — read it first, every run; it binds every write |
| Who the user is | `profile/me`; skills evidence `profile/skills`; base CV text `templates/cv` field `text` |
| Deal-breakers, preferences, pluses, concerns | `profile/prefs` — read it live every run |
| Limits and switches (company research freshness, pay sources) | `profile/settings`; a missing value means use the default below |
| Roles, companies, sectors | `roles`, `companies`, `sectors` (`priority` is the sector rating) |
| ATS endpoints, and how to read ads on sites that load them with JavaScript (section 1c) | `refs/ats-endpoints` |

A deal-breaker's `check` note says how to test it and wins over anything general here. Name a rule the
way the board does (its name with its id) in everything you write.

**Empty board.** If there are no waiting Shortlist rows and no Shortlist roles to research, say so in one
line and stop. Checking that roles are still open, folding and the fix queue are the
`next-role-daily-check` skill's job, not this one's.

## The three things this pass must not do

1. **It must not decide.** No pass, no reject, no "recommend applying". It writes research and open
   questions and stops. `stage` is not yours to change.
2. **It must not score Fun or Shot.** They stay `null`. A warm route is the largest single input to Shot
   and only the user can weigh it.
3. **It must not claim a role is open without proof.** `linkChecked` is written only from the employer
   board's index of current openings or a real browser session, never from a fetched page. A wrong value
   is worse than an empty one.

**Absence of data never fails a deal-breaker**, unless that rule's check note says otherwise. An unknown
passes through tagged unknown and becomes an open question.

## 1. Read the criteria

From `profile/prefs`: `hardRules` (id, name, fires, rule, `check`, `firm`, `basis`), `scored` (id, name,
bands, `basis`, `stage`), `upside`, `red`. A preference with `stage: "shortlist"` is researched here,
not by the sweep. `basis: "company"` means decide it once per company and keep it on the company row.

## 2. Read waiting Shortlist rows first

**Longlist rows are not yours.** A pasted link lands on the Longlist and is read by
`next-role-longlist-research`, which runs before this skill. This step covers only rows at the Shortlist,
parked or To apply (`consideration`, `parked`, `prep`) with `readState: "waiting"`: roles the user added
with the Add one form, and any pasted role the user sent on before it was read.

Such a row has a `url`, sometimes a guessed `title`/`company` (`titleGuess: true`), and sometimes `pasted`,
the posting text the user copied in. **Read every one before researching anything.**

1. If `pasted` holds text, read the posting from that. It wins over any fetch.
2. Otherwise read the employer's own posting. **Never use a logged-in LinkedIn session** (it breaks
   LinkedIn's terms and risks the user's account). From a LinkedIn link take the title and company, find
   the same role on the employer's careers site, use that posting, set `url` to it, and keep the LinkedIn
   link in `sourceUrl`.
3. On success: fill `title`, `company`, `companyId`, `location`, `office`, `salary`, `closing`, set
   `titleGuess: false`, `readState: "read"`, then research it like any other shortlist row.
4. On failure: add 1 to `readTries`. Flag only on the second failed run (a page can just be down),
   except a removed posting, which is flagged at once. To flag, set `readState: "needs"` and `readReason`
   to one of `login`, `gone`, `blocked`, `notfound` (LinkedIn-only, not on the employer's site).
   **Never research a role you could not read**: research built on a guessed title is worse than none.
5. Name every flagged row in the report.

### Pages that load the ad with JavaScript

This applies to **every** posting this pass fetches, waiting rows or not. Some careers sites (Oracle,
Workday, SuccessFactors, iCIMS, SmartRecruiters) build the ad in the browser, so a plain fetch returns a
near-empty page: a cookie banner, a title, no responsibilities or requirements. That is not a read.

1. Read `refs/ats-endpoints` section 1c ("Reading one ad") once per run.
2. When a fetch comes back near-empty, match the link's host to a row there, build the feed address from the
   link exactly as the row says, and fetch that. If it carries the ad, it is the posting. It never counts as
   proof the role is open.
3. No row for the host, or the feed fails too: set `readState: "needs"`, `readReason: "nofeed"` and
   `readHost` (the link's host). Don't add to `readTries`. The board lists these in Data health under Job
   sites we can't read yet, and `next-role-fix` works out the site's pattern once.
   - When the title and company are real (`titleGuess` not true), still do the company pass and everything
     the role pass can do without the ad (pay estimate, rules from the company row and the listing), so the
     row is useful. With a guessed title, research nothing.
   - **Leave Role Fit rough** and the rules that need the ad `unknown`. Never score a proper fit, write a
     summary of duties, or pass a rule from the fragment.
   - Say in `g2Note` that the ad couldn't be read and why.

**A waiting row that already has research is a re-read**: `next-role-fix` sets `readState: "waiting"` once
the site's pattern exists. Read the ad, then refresh from it: `enrich.summary`, `enrich.gate2Rules`, the
role-level `highlights`, `green` and `red`, `closing`, and a proper Role Fit (unless the user edited it).
Keep the company row, the pay figures unless the ad states pay, and everything the user wrote. Don't change
`g2At`. Add one line to `g2Note`.

A role added with the form may have skipped the Longlist, so `fun` and `shot` can be empty; the user
scores them.

### Roles the user added by hand

Rows with `source: "self"` and `addedVia: "form"` differ in four ways:

1. **The posting is optional.** Read `pasted`, then the `spec` file, then the `url`. The `spec` file is in
   the board's asset store: read it with the Artifact tool (`action: "read"`, the board url, `path` =
   `spec.id`). A row with none of the three came from a conversation: research the company and what the
   title and `intakeNote` say, and put everything else in open questions. Still set `g2At`.
2. **Check every deal-breaker**, whatever stage it fires at. Write each result to `enrich.gate2Rules` as
   pass / fail / unknown. **Never reject**: a fail is shown on the card and the user decides.
3. **Quick-check and longlist results are provisional.** Replace `enrich.gate2Rules` written with
   `enrich.rulesFrom: "quick"` or `"longlist"`, and a `fit` with `basis: "quick"`, with your own, and write
   `enrich.rulesFrom: ""`.
4. **A person-led role with no link is the person's to confirm.** When `contact.personId` is set and there
   is no `url`, never write `linkChecked`. If you find the role in the employer's own board index, write
   `url`, `linkChecked: <today>` and `linkMethod: "index"`.

`intakeNote`, `contact` and `spec` are the user's. Read them; never overwrite them.

## 3. Pick up the right rows, and read the company first

Take every row with **no research yet** whose `stage` is `consideration`, `parked` or `prep` (To apply).
A row has research when `enrich.summary` and `enrich.gate2Rules` are both filled.

**Never use `g2At` to decide whether a row is researched.** The board writes `g2At` as the day the user
chose to apply, so a role sent to To apply before its research ran (or, on older rows, parked) carries a
`g2At` with nothing behind it. Only the research itself counts.

- A **parked** role ("not now") is researched once, so the research is there when it comes back for a
  decision.
- A role at **To apply** with no research is researched now, before `next-role-apply-pack` builds its pack.
- A row that has research is never researched again by this step, whatever its stage.

**A `consideration` or `parked` row with research but no `g2At` is a failed write-back, not a row to
research.** Set `g2At` to the date that research was done, add one line to `g2Note` saying so, and change
nothing else. If you can't tell when it ran, set today and say so in `g2Note`; never guess a past date.

For each row, **read `companies/<companyId>` before researching anything**:
- **Company row checked within `profile/settings` `research.companyFreshDays` (default 60):** inherit it.
  Spend the pass on the seat. Add to the company row only a fact the new posting reveals.
- **Older than that:** refresh what goes stale (health, comp, headcount), keep the rest, update `checkedAt`.
- **No company row:** create it. This is the expensive pass, paid once.

A role with no `companyId` gets one: slug the company name, and check for an existing row under that slug
first.

## 4. The company pass — what belongs on the company row

```
name, aka,                       // legal entity, former names, parent
priority,                        // NEVER write this: the user's field
watch, watchWhy, onTargetList,
warm, warmNote,                  // is there a contact who would recommend
sector, size, hq, sites,
health,                          // ownership, filings, funding, layoffs, direction
culture,                         // review data with its volume stated, structure, what it's like
comp,                            // bands seen, comp sub-scores, benefits, pension
ai,                              // AI in the product, and separately whether they work AI-natively
ladder,                          // the rungs that exist, and where
officeDays, officeNote,
green: [], red: [],              // company-level flags only
questions: [],                   // asked once; covers every role here
notes: [],                       // the user's, never yours
summary,                         // two lines, verdict first
checkedAt
```

Company-basis deal-breakers and preferences are decided here and kept here.

**Never store whether a role is open** on the company; the board works it out from the roles.

Three things a research pass gets wrong if not told:
- **State review volume, always.** "3.5/5 from 14 reviews, 32% would recommend" is a concern to test;
  "3.5/5" alone reads as a verdict.
- **Separate shipping AI from working AI-natively.** They're different facts that point different ways.
- **A question that's true of the company goes on the company row**, even when you found it on a role.
  Test: would you ask it again for a different job there? Office days, pay bands, a restructure, whether
  the rung above exists: all company.

## 5. The role pass — what stays on the row

```
companyId,
referral,                         // THIS seat's referral state, not the company's route
location, office, salary, closing, postingAge, linkChecked,
pay: { base: {value, kind, source}, total: {value, kind, source} },
highlights: [{code, label, band}],
green: [], red: [],               // role-level only
enrich: {
  summary,                        // what the job actually is
  seatPackage,                    // what's known about THIS seat's pay
  gate2Rules: {},                 // the deal-breakers that fire here, pass / fail / unknown
  expensive: {},                  // role-basis preferences with stage "shortlist"
  openQuestions: []               // role-level only
},
g2At, g2Note
```

`enrich.gate2Rules` covers every rule whose `fires` names the shortlist (stored as "Gate 2") or
enrichment, plus any search-stage rule the sweep left unknown.

**A row from the Longlist arrives with provisional results** (`enrich.rulesFrom: "longlist"`) from
`next-role-longlist-research`. They don't count as research: check the rules again with what you now know,
replace them, and write `enrich.rulesFrom: ""`. Keep its `highlights` and flags, adding to them; replace a
rough `fit` with a proper one.

### Pay, always

**Every shortlist role leaves this pass with a pay figure and where it came from**, as `{value, kind, source}`:
- `kind: "stated"`: the ad says it, or a recruiter or interviewer told the user (their notes on the board).
  `source`: "The ad", "Recruiter's ad", or "Screening call, <date>".
- `kind: "estimate"`: nothing stated. Look it up from the company row's `comp`, then the sites in
  `profile/settings` `research.paySources`, in order, stopping at the first usable answer. Write a range,
  and in `source` name the site(s), the date, and "low confidence" when sources disagree or the sample is
  tiny.
- Never write `kind: "offer"`: real offers are entered by the user.

The board judges the pay deal-breaker on these figures: a stated figure below the bar fails, an estimate
below it is only "at risk". Never present an estimate as stated.

### Role Fit, always

**Every shortlist role leaves this pass with a proper Role Fit**, from the full ad, following the
`next-role-role-fit` skill. The one exception is an ad that couldn't be read (`readReason: "nofeed"`, above):
its fit stays rough until the site is fixed, and the role is flagged so the user sees why. It replaces a rough longlist score, unless the user has edited it, in which
case you only add suggestions. Also score roles at To apply or later that have no `fit`.

### Writing the row back

- **Merge fields; never replace the row.** The row carries fields this pass doesn't produce (`referral`,
  `seen`, `source`, `stage`, anything the user edited), and a whole-row write drops them silently.
- **Never clear `linkChecked`.** Leave it empty only where it was already empty.
- **Set `g2At` to today on every `consideration` or `parked` row you finish where it is empty**, including
  one where rules came out unknown and the open questions outnumber the answers. **Never change `g2At` on a
  role at To apply**: there it is the day the user chose to apply. A finished row must have `enrich.summary`
  and `enrich.gate2Rules` filled, or it is researched again next run.
- `referral` (this seat) and the company's `warm` (a route exists) are different facts.
- **Don't copy company facts onto the row.** A duplicated fact will disagree with itself within a fortnight.

Every text field follows `profile/brief`'s Keep it short rules.

## 6. Company fields only the user sets

- **Never set or change `priority`.** `unrated` is correct for a company the user hasn't rated.
- **Never move a company to `rejected`.** A serious problem goes in `red` and the company stays searched.
  The only states a pass may set are `excluded` (the whole business breaks a company deal-breaker) and
  `defunct` (may not exist), and both are raised in the report rather than applied quietly.
- A rejected role carries `endReason` and `endNote`. Read them when a company comes round again.

## 7. Report, briefly

Per role: what it is, what passes, what's open, its Role Fit (band, % and the biggest must-have gap), and
the one question that decides it. **Lead with the deciding question**, not the company's history.

Then: which company rows were **inherited rather than researched**, which pasted links couldn't be read, and
which ads were flagged `nofeed`, with their site (Data health › Job sites we can't read yet).

## Related

- `next-role-daily-check` — runs first: open checks, folding and the fix queue.
- `next-role-longlist-research` — runs next: reads pasted links and gives Longlist roles their provisional
  deal-breaker results, highlights and Role Fit, which this pass replaces.
- `next-role-sweep` — builds the longlist.
- `next-role-role-fit` — how Role Fit is scored; this pass writes it.
- `next-role-interview-prep` — runs on roles the user moves to apply.