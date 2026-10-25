# Installing Next Role: instructions for Claude

You are installing Next Role for the person you're talking to, in their own Claude account, from this
repository. Follow these steps in order. Talk to them in plain words, no jargon; they may not be technical.
Each step says what **you** do and what **they** do.

**Before step 1, give them their own copy of the checklist** below, so they can see where they are: make it a
Tasks artifact if the Artifact tool lists a Tasks type, otherwise a short checklist in the chat that you repost,
ticked, after each step. Tick each step only when its check passes.

```
[ ] 1. Get the files
[ ] 2. Publish your board
[ ] 3. Open your board once (you)
[ ] 4. Write the reference material onto the board
[ ] 5. Install the skills (you press Save on each card)
[ ] 6. Project instructions and the board's code guide (you paste and upload)
[ ] 7. Gmail: job-alerts label
[ ] 8. Claude in Chrome works
[ ] 9. Installation check
```

They should be in a chat inside a Claude Project made for this (step 1 of INSTALL.md). If they aren't, ask
them to make one called *Next Role*, then paste the install request again in a chat there.

## 1. Get the files

Clone the repository into your working directory:
`git clone --depth 1 https://github.com/stephenpollock79/next-role`. If that's refused, ask them to download the
repo as a ZIP (green *Code* button › Download ZIP) and attach it; unzip it and carry on from that copy.

Check: `board/index.html`, `board/js/` (52 files), `board/css/`, `skills/` (11 folders) and `install/` are there.
Note the commit you cloned (`git rev-parse HEAD`): it's the version they're installing.

## 2. Publish their board

Publish `board/index.html` with the Artifact tool as a **new** artifact (no `url`), with:

- `files`: every file under `board/js/` and `board/css/`, each at its path relative to `board/` (`js/01-core.js`,
  `css/base.css`, …). The page loads them by those paths.
- `capabilities`: `{"db": {}, "sample": {}, "assets": {}, "downloads": {}}`.
- `contract`: `"0.2.56"`, the runtime version the board is tested on.
- `title`: `Next Role`; `icon`: `briefcase`.

Keep the link the result gives you: it's their board's link (`https://claude.ai/artifact/…`). Check: the publish
succeeded and the result lists the files.

## 3. They open the board once

Give them the board's link as a plain URL (the `url` from the publish result), and ask them to:

1. **Open it in Chrome**, in the Chrome they'll use for their search (the one with Claude in Chrome), full width.
2. **Bookmark it** (the star at the right of the address bar), so they can always find their board.
3. **Wait a few seconds** until the board shows **Overview** with a **Setup 0 of 12** card (a small "Your board
   is ready to set up" note also flashes at the bottom), then reply "done".

Say this as numbered steps, in those words. The board makes its own starting records the first time it opens:
settings, empty profile records and the standard channels. **Write nothing to the board before this**: the board
only makes its starting records on a board with nothing on it.

Check: read `profile/settings` with ArtifactData (`get`). If it's missing, wait for them and read again.

## 4. Write the reference material onto the board

With ArtifactData `set` (these are new documents):

| Board document | From |
| --- | --- |
| `profile/brief` | `install/brief.json` |
| `refs/skills` | `install/refs/skills.json` |
| `refs/ats-endpoints` | `install/refs/ats-endpoints.json` |
| `refs/redline` | `install/refs/redline.json` |

Then `update` `profile/settings` (read it first and pin `if_version`) with
`board: {url: "<the board's link>", installedFrom: "<the commit from step 1>"}`, keeping any other fields already
under `board`. The board puts the link in every
request it copies for Claude, so the skills work on the right board; `installedFrom` is what a later update
compares against, so their own changes to the board are kept.

Check: each of the four documents reads back, `profile/settings` `board.url` is the link and `board.installedFrom`
the commit.

## 5. Install the skills

Install each skill in `skills/` (11 of them, all named `next-role-*`) in their account. Propose each one with the
`propose_skills` tool as a **new** skill: its `name` and `description` from the file's front matter, and its
whole `SKILL.md` as the text. At most three per call, so four calls. Tell them to press **Save** on each card, and that a card may need
**Save** pressed twice: it's saved when the card changes to say so.

If `propose_skills` isn't available, zip each skill folder (`next-role-sweep.zip` containing
`next-role-sweep/SKILL.md`), send them the zips, and ask them to add each one in Claude's settings
(their initials at the bottom left › Settings › Capabilities › Skills › Upload).

Check: ask them to confirm all 11 are saved. If a skill tool listing is available to you, confirm the names.

## 6. Project instructions and the board's code guide

**Instructions.** Fill `install/project-instructions.md` with their board's link in place of `<BOARD LINK>` and
show it to them in a code block. These tell every chat and scheduled run in the project where their board is,
which skills do what, and how to change the board itself. Assume they've never used project instructions, and
give these steps, numbered, after the code block:

1. Click **Copy** at the top right of the box above.
2. Open the project: **Projects** in the left-hand menu › **Next Role**.
3. On the project's page, find **Instructions** on the right and click it (or its pencil or **+**).
4. Paste into the box (Cmd + V on a Mac, Ctrl + V on Windows) and click **Save**.
5. Come back to this chat (it's listed on the project's page) and reply "done".

Claude's screens change from time to time: if something doesn't look like this, tell them to describe what they
see, and help them from that.

**Code guide.** Next Role is theirs to fix and extend by asking Claude, and `docs/board-architecture.md` is the
map Claude reads before changing the board's code. It must be in their project's files, named
`board-architecture.md`. If you can add files to the project yourself, do. Otherwise send them the file and give
these steps, numbered:

1. Download the file: click the file card in this chat, then **Download**.
2. On the project's page, find **Files** on the right and click **+** › **Upload from device**.
3. Pick `board-architecture.md` from your Downloads folder.
4. Come back to this chat and reply "done".

Tell them, in a sentence, that they can ask Claude in this project to fix or add to their board, and that Claude
keeps a list of their changes in that file so updates don't undo them.

Check: they confirm the instructions are pasted, and `board-architecture.md` is in the project's files (if you
can see the project's files, look; otherwise ask).

## 7. Gmail: the job-alerts label

If Gmail is connected (the Gmail tools are available; load them with ToolSearch), make sure a label with the name
in `profile/settings` `alerts.gmailLabel` (default `Job Alerts`) exists, and create it if not. Setup's Job alerts
step later adds the filter that files alert emails under it.

If Gmail isn't connected, tell them how (their initials at the bottom left › Settings › Connectors › Gmail), and that they can carry on without it:
the sweep then reads job sites and companies' pages directly, and sites that only send alerts become ones they
check themselves.

Check: the label exists, or Gmail is knowingly skipped.

## 8. Claude in Chrome

Check that Claude in Chrome answers: load its tools with ToolSearch and list their open tabs. If it doesn't
answer, point them to https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome and
carry on: it's only needed for setup's Job alerts step, which they can do later.

## 9. Installation check

Show this list, each line ✓ or ✗ with a few words:

1. Board published, with its link
2. Board opened, starting records made
3. Brief and the three reference documents on the board; `board.url` set
4. All 11 skills saved
5. Project instructions pasted, and `board-architecture.md` in the project's files
6. Gmail connected and the job-alerts label made (or skipped on purpose)
7. Claude in Chrome answering (or to do before setup's Job alerts step)

For any ✗, say what to do, and redo only that step when they ask.

When everything that matters is ✓ (1–5 are required; 6 and 7 can wait), tell them: **open your board and press
Set up the board**. The setup wizard does the rest, and hands parts of it back to Claude with a *Copy for Claude*
request they paste into a new chat in this project.

## If they come back later

- **"Fix the failed installation steps"**: rerun the check, then redo only the ✗ steps.
- **A newer version of Next Role**: read `profile/settings` `board.installedFrom` and the project's
  `board-architecture.md` ("Changes on this board"). For each board file that differs between
  `installedFrom` and the new version: if they haven't changed it (it matches `installedFrom` on their live
  board), take the new one; if they have, merge the two by hand, keeping their change, and show them the
  merged result before publishing. Republish to their board's `url` with only the changed files (omit
  `capabilities` and `contract`), bump the cache key, then set `installedFrom` to the new commit. Skills: propose
  the updated ones as **improvements**, again keeping any changes they made. Update their `board-architecture.md`
  from the new `docs/board-architecture.md`, carrying over their "Changes on this board" list. Never overwrite
  their board's data; the reference documents in `install/` may be replaced with `set` (`profile/brief` and
  `refs/*` only).
