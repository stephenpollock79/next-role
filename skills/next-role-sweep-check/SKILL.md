---
name: "next-role-sweep-check"
description: "Weekly screen-out check for a Next Role board: picks a few of the week's screen-outs most likely to be wrong plus one at random, re-reads each ad, and queues them for the user to confirm."
---

# Weekly screen-out check

The sweep screens out hundreds of roles with the user's deal-breakers, and nobody reads that list. This pass
picks a handful for the user to confirm each week, so a rule that cuts roles they'd want, or a rule the sweep
misreads, shows up within weeks instead of never. **It prepares the check; it never answers it.** Whether a
screen-out was right is the user's call, made on the board.

## Where everything lives

**The board is the source of truth.** Read and write it with the artifact database tool (`ArtifactData`).
The board's URL comes from the scheduled task's prompt or the project's instructions; if neither gives one,
stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (Keep it short, the words to use) | `profile/brief`, read first every run; it binds every write |
| Who the user is and what they want | `profile/me`, `profile/prefs` (`scored`, `upside`, `red`) |
| Deal-breakers | `profile/prefs` `hardRules`: id, name, rule, `check` (how to test it), `firm` (fixed / firm / tunable) |
| Limits | `profile/settings` `sweepCheck.size` (default 5), `sweepCheck.maxPostings` (default 10) |
| What the sweep screened out | `screened`: one doc per sweep, `date`, `items` [{title, company, rule, saw, source, url, near}] |
| Spot-checks the user already made | `rulechecks` (doc id = the slug below): `outcome` correct / wrong / other, `otherRule`, `wanted` (true only for a wrong cut), `revisit`, `revisitNote`, `revisitAt` |
| "Keep as is" decisions on flagged rules | `rulerevisit` (doc id = slug of the rule id): `rule`, `decision`, `at` |
| Rule changes | `rulelog` (entries with no `kind`, or `kind: "rule"`; `ruleId`, `at`) |
| This check's output | `ruleaudit` |

Name a rule the way the board does, its name with its id: "<name> (<id>)".

## The things this pass must not do

1. **Never answer for the user.** Don't write `rulechecks` or `rulerevisit`, never set a `ruleaudit` doc's
   `status` to anything but `open`, and never set `outcome`, `revisit` or `revisitNote`. Those are the user's.
2. **Never change a deal-breaker, a check note, a role or a company.** Suggesting a change is the board's job,
   once the user's answers add up.
3. **Never claim an ad is open without seeing it.** `live: true` only when you read the employer's own posting
   (or its board index) and it is open; `live: false` only when it is clearly removed or closed; otherwise `null`.
4. **Never mark a fixed rule "too strict".** A fixed rule is a fact of the user's life or the law. If a fixed
   rule's screen-out looks wrong, the verdict is `misapplied` (the sweep read it wrong), never `strict`.

## 1. Is there anything to check?

- **Week** = today's date (YYYY-MM-DD, in `profile/me` `timezone`; Europe/London when it has none).
- If any `ruleaudit` doc already has `week` = today, this week's check exists: stop, write nothing.
- **Candidates** = every item in `screened` docs dated within the last 7 days whose `rule` is the id of a
  current deal-breaker. Leave out items whose `rule` is not a deal-breaker id ("closed", "gone from employer
  board" and the like are not screen-outs by a rule), items already spot-checked (a `rulechecks` doc with the
  item's slug), items already in any `ruleaudit` doc (same slug), and duplicates (same rule, company and title).
- The slug: lower-case `rule-company-title`, every run of non-letters-or-digits turned into one `-`, no `-` at
  either end, cut to 90 characters.
- **No candidates:** write nothing; report "Nothing screened out by a deal-breaker this week, so no check."

## 2. Pick the doubtful ones

Pick `sweepCheck.size` (N) in all: N − 1 **flagged** and 1 **random**. With fewer than N candidates, take them
all, with one of them as the random pick.

1. **The random one first.** Choose it uniformly at random from all candidates, before looking at any. It is a
   control on your own flagging, so don't let the triage below influence it.
2. **Triage the rest** from title, company, `saw` and the rule text alone, no fetching. Rank by how likely the
   screen-out is wrong:
   - `near: true` (the sweep itself said it was close);
   - `saw` is thin, vague or doesn't actually show the rule failing ("hybrid" for an office-days rule, a
     country name when the posting may allow remote, a guess from the company name);
   - the rule's `check` note says to look somewhere the `saw` suggests the sweep didn't;
   - the role otherwise looks like what the user wants (title, level, sector, their `scored` preferences);
   - rules where the user has found wrong cuts before (`rulechecks` with `wanted: true`, i.e. `outcome: "wrong"`;
     older docs without `outcome` mean the same).
   Spread the picks: no more than two from one rule unless only one rule has candidates.
3. **Read the ads** of the top candidates, in rank order, up to `sweepCheck.maxPostings` ads including the
   random one. Read the employer's own posting. **Never use a logged-in LinkedIn session**: from a LinkedIn link
   find the same role on the employer's careers site. If an ad can't be read, judge from what you have and say
   so in `why`.
4. **Judge each one fresh.** Read the rule and its `check` note, then the ad, and decide from the ad, not from
   the sweep's `saw`. Treat the sweep's call as a claim to test.
   - `correct`: the rule applies on the facts.
   - `misapplied`: on the facts in the ad, the rule doesn't apply (the sweep misread it).
   - `strict`: the rule applies as written, but the role otherwise fits what the user wants, so they might want
     it anyway. Never for a fixed rule. (On the board the user answers Correct and may flag the rule as worth
     revisiting; your verdict is what prompts that.)
   - If the ad has gone and nothing else shows what it said, say so in `why` and set `live: false`; the user can
     answer Can't verify.
5. **Keep the N − 1 flagged picks most likely to be wrong** (`misapplied` first, then `strict`, then the most
   borderline `correct`). The random pick stays whatever its verdict.

## 3. Write the check

One `ruleaudit` doc per pick, in one batch, doc id `ra-<week>-<n>` (n = 0…N−1):

```
week,            // today, YYYY-MM-DD
order,           // display order 0…N−1: flagged by doubt, the random pick placed at a random position
pick,            // "flagged" | "random" (the board never shows this to the user)
rule,            // the deal-breaker id
title, company, url, saw, source, near,   // copied from the screened item; url = the employer's posting if you found it
date,            // the sweep date of the screened doc
verdict,         // "correct" | "misapplied" | "strict"
why,             // one sentence, under 25 words, plain English in the user's spelling (profile/me spelling): what in the ad decides it
live,            // true | false | null, see the rules above
status: "open",
createdAt        // ISO timestamp
```

Older weeks' open docs are left as they are: the board only shows the latest week.

## 4. Report, briefly

One line: how many are ready to check, how many look wrong and under which rules (name with id). Add a second
line only if the random pick looks wrong: that suggests the flagging is missing things.

Then the running count of "Rule worth revisiting" flags, one line per rule that has any, only when there are
flags. For each rule, count `rulechecks` with `revisit: true` whose `revisitAt` (else `atIso`) is later than both
the rule's newest `rulelog` entry and its `rulerevisit` doc's `at`. Name the companies, e.g.
"<name> (<id>): 2 flagged (Acme, Globex)." When a rule has 3 or more, add "a decision is waiting on the board".
Never decide it or suggest which way.

## Related

- `next-role-sweep`: does the screening this pass checks; its `check` notes are what a misapplied verdict
  points at.
- The board turns the user's answers into spot-checks. Wrong cuts are tallied per rule since it last changed;
  five or more checks with one in five wrong offers Suggest a change to how the sweep checks it. Flags are
  counted separately; at three on one rule the board asks the user to keep the rule, add a narrow exception or
  drop it. Nothing changes a rule automatically.