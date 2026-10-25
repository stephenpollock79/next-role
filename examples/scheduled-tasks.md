# The scheduled tasks

Setup (step 11, Your rhythm) creates these four in your Claude account from the times you choose; the board fills in your board link and time zone. This file is for reference, or for setting them up yourself.

- Attach Gmail to the sweep only; nothing to the others.
- Run the sweep on Sonnet (it uses much less of your allowance); the others on your default model.
- Turn on **Automatically approve** in each task's settings, or every run stops and waits for you.
- Leave **Require this computer** off (Advanced settings), so the tasks run in the cloud even when your computer is asleep.
- Copy each prompt exactly: the run records in them are what the board's Data health reads.

## Next Role sweep

**When:** Sun and Wed at 17:45 (example; your own times come from setup)  
**Connect:** Gmail  
**Model:** Sonnet

```
Run the job sweep with the `next-role-sweep` skill, following it exactly. Its limits come from the board's `profile/settings`.

Board: <your board link> — read and write it with the ArtifactData tool (load it with ToolSearch "select:ArtifactData" if needed). Load the Gmail tools with ToolSearch if they aren't loaded.

On the run doc the skill writes to `runs`, also make sure of these (the board's Data health reads them): `model` (the model ID this session runs on); `sources` has an entry for every source the sweep tried, each with `id`, `name`, `found` (a number, 0 when none) and `status` (`ok`, `empty`, `blocked` or `error`, with a short `note` when not ok; an error reading Gmail is `error` on each alert source); set `capped: true` with a one-line `cappedNote` when the run stopped before checking everything because of a limit in `profile/settings` or time, otherwise `capped: false`; and `left` (a number: how many sources and company boards it didn't reach when capped; 0 otherwise).

Finish with the report the skill describes.
```

## Next Role morning, part 1

**When:** daily at 07:00 (example; your own times come from setup)

```
Daily Next Role morning run, part 1 (upkeep). Part 2 (shortlist, apply packs, interview prep) runs later as its own scheduled task.

Board: <your board link> — read and write it with the ArtifactData tool (load it with ToolSearch "select:ArtifactData" if needed). Files in the board's file store are read with the Artifact tool. No browser is available.

Run these skills in order, each followed exactly:
1. `next-role-daily-check`
2. `next-role-longlist-research`

Run record (the board's Data health uses these to spot a task that failed, didn't run, or keeps running out of room): after each skill, write one doc to collection `taskruns`, doc id `<YYYY-MM-DD>-<type>` with type `daily-check` or `longlist-research`, fields: `type`, `date` (today, <your time zone>), `at` (ISO timestamp), `model` (the model ID this session runs on), `status` (`ok`, `partial` if it finished only part of its work, `failed` if it couldn't run), `capped` (true if it stopped early because of a limit in `profile/settings` or time), `cappedNote` (what was left undone, when capped), `left` (a number: how many items it left undone — companies, roles — when capped; 0 otherwise), `note` (one short line, only when partial or failed). Write it even on a quiet morning with nothing to do (status `ok`, `left: 0`). If a skill can't run at all, still write its record with status `failed` and the reason in `note`, then carry on with the next skill.

Then keep the skills list in step: compare the `next-role-*` skills available in this session (names and descriptions) with board doc `refs/skills`. If a skill is missing, a listed skill no longer exists, or a description has changed, update that entry (`name`, `trigger`, `does`, `reads`, `writes`, from the skill's own instructions) and `updatedAt`, pinned with `if_version`. Nothing different → write nothing.

A quiet morning (nothing to do anywhere) writes only the run records and sends no report. Otherwise finish with one short report made of each skill's own report section, only for what was done.
```

## Next Role morning, part 2

**When:** daily at 07:45 (example; your own times come from setup)

```
Daily Next Role morning run, part 2 (research and writing). Part 1 (daily check and longlist research) runs earlier as its own scheduled task.

Board: <your board link> — read and write it with the ArtifactData tool (load it with ToolSearch "select:ArtifactData" if needed). Files in the board's file store are read with the Artifact tool. No browser is available.

Run these skills in order, each followed exactly:
1. `next-role-shortlist`
2. `next-role-apply-pack`
3. `next-role-interview-prep`

Run record (the board's Data health uses these to spot a task that failed, didn't run, or keeps running out of room): after each skill, write one doc to collection `taskruns`, doc id `<YYYY-MM-DD>-<type>` with type `shortlist`, `apply-pack` or `interview-prep`, fields: `type`, `date` (today, <your time zone>), `at` (ISO timestamp), `model` (the model ID this session runs on), `status` (`ok`, `partial` if it finished only part of its work, `failed` if it couldn't run), `capped` (true if it stopped early because of a limit in `profile/settings` or time), `cappedNote` (what was left undone, when capped), `left` (a number: how many items it left undone — companies, roles, packs — when capped; 0 otherwise), `note` (one short line, only when partial or failed). Write it even on a quiet morning with nothing to do (status `ok`, `left: 0`). If a skill can't run at all, still write its record with status `failed` and the reason in `note`, then carry on with the next skill.

A quiet morning (nothing to do anywhere) writes only the run records and sends no report. Otherwise finish with one short report made of each skill's own report section, only for what was done.
```

## Next Role screen-out check

**When:** Mondays at 07:20 (example; your own times come from setup)

```
Run the weekly screen-out check with the `next-role-sweep-check` skill, following it exactly. Its limits come from the board's `profile/settings` (`sweepCheck`).

Board: <your board link> — read and write it with the ArtifactData tool (load it with ToolSearch "select:ArtifactData" if needed). No browser is available; read job ads with WebFetch.

If the `next-role-sweep-check` skill isn't available in this session, write nothing except the run record below, and report that in one line.

Run record (the board's Data health uses it to spot a check that failed, didn't run, or keeps running out of room): at the end, write one doc to collection `taskruns`, doc id `<YYYY-MM-DD>-sweep-check`, fields `type: "sweep-check"`, `date` (today, <your time zone>), `at` (ISO timestamp), `model` (the model ID this session runs on), `status` (`ok`, `partial` or `failed`), `capped` (true if it stopped early because of `sweepCheck.maxPostings` or time), `cappedNote` when capped, `left` (a number: how many picks it didn't check when capped; 0 otherwise), and `note` (one short line, only when partial or failed). Write it on a week with nothing to check too (status `ok`, `left: 0`).

Finish with the short report the skill describes. A week with nothing to check writes only the run record and needs no report beyond that one line.
```

