# Installing Next Role

Everything you need to install Next Role in your own Claude account and get it running. Back to the
[overview](README.md).

## Before you install

- **Try the demo first.** [The demo board](https://stephenpollock79.github.io/next-role/demo/) is the real board
  with made-up data, no sign-in needed. Have a look before you commit the time.
- **It takes a few hours to set up.** Installing takes about 30 minutes. Setup then takes about 3 to 5 hours of your
  time over a day or two, in a guided wizard on the board, while Claude does its parts in the background. That
  time goes into tailoring it to you (your CV, what you want, the companies you'd like) and setting up where your
  roles come from: job sites, company careers pages and job alerts. Setup uses about 10% of a Pro plan's
  weekly allowance.
- **Do it on a computer** (Mac or Windows), in the Claude desktop app, not on a phone or tablet. Once it's
  running, you can check your board from anywhere, your phone included.
- **Expect to tune it in the first week or two.** The first sweeps will let through some roles you don't want
  and miss some you do. Each time you turn a role down you say why, and the board uses that, plus a weekly check
  of what it screened out, to suggest changes to your preferences and rules. Accept the ones that fit.
- **Your data stays yours.** Your CV, preferences and roles live only in your own Claude account, private to
  you unless you choose to share the board. Nothing is sent to me, or to any service beyond Claude itself.
- **It never applies or sends anything for you.** It finds, researches and drafts; you decide and send.
- **It's free.** The only cost is a paid Claude plan (Pro or above; see the usage note below). It's free for
  personal, non-commercial use under the [licence](LICENSE.md).
- **It's not a supported product.** It won't get regular updates, fixes or new features. It's yours to change,
  though: ask Claude in your Next Role project to fix something or add a feature, and it changes your copy.
- **Built for product roles, works for others.** I built and tested it for my own product-management search. It
  asks your profession at setup and words everything to suit, but expect to adjust more for other fields.
  The board and its drafts are in English (UK or US).

## What you'll need

| | |
| --- | --- |
| **A paid Claude plan** | Pro or above. Next Role runs as scheduled tasks and uses Claude in Chrome, both on paid plans. |
| **Usage** | In testing, a normal week (two sweeps, a morning run every day and one weekly check) used about half of a Pro plan's weekly allowance, on a busy board. Expect less on a new board, with the sweep on Sonnet. Pro leaves little room for other Claude use, so if you already use Claude a lot, consider Max. Running the morning run on weekdays only saves about a fifth. |
| **Gmail** | For job-alert emails. If you'd rather not use your main address, make a free Gmail just for job alerts. No Gmail at all? It still works: the sweep reads job sites and company pages directly, and alert-only sites become ones you check yourself. |
| **The Claude desktop app** | Install and set up in the desktop app (Mac or Windows), not claude.ai in a browser: it's the way Anthropic documents for Claude to use your Chrome, which setup's Job alerts step needs. Once set up, the scheduled runs happen in the cloud, so you can use Claude anywhere. |
| **Claude in Chrome** | The browser extension. Setup uses it to create your job alerts on LinkedIn and other sites, in your own signed-in browser. |
| **Your CV** | As a Word file (.docx), plus a cover letter if you have one. |
| **LinkedIn connections export** *(optional)* | For Warm routes: people you know at the companies you want. LinkedIn takes about a day to send it, so request it early: LinkedIn › Settings › Data privacy › Get a copy of your data › Connections. |

---

## Install

Do these in order. Claude does most of the work; you do the parts marked **You**.

1. **You: install the Claude desktop app and make a Claude Project.** Download the app from
   [claude.ai/download](https://claude.ai/download), install it and sign in. Do the rest of installation and setup
   in the app, not claude.ai in a browser. Then make a Project called *Next Role* (Projects › New project). Everything to do with
   your search happens in chats inside this project. Only give it a name: leave the description, instructions and
   files empty. Claude gives you the instructions to paste, and the file to add, in step 4.
2. **You: connect Gmail and install Claude in Chrome.**
   - **Gmail:** click your initials at the bottom left › Settings › Connectors › Gmail › Connect, and sign in with
     the Gmail address you'll use for job alerts.
   - **Claude in Chrome:** in Chrome (the browser, or Chrome profile, you'll use for your search), open the Chrome
     Web Store, search for **Claude** and pick the one by **Anthropic** › Add to Chrome. Pin it (the jigsaw icon at
     the top right of Chrome › the pin next to Claude), click it and sign in with the same Claude account.
     Nothing to turn on in Claude: it's on by default (Settings › Claude in Chrome, if you want to check).

   Claude's settings screens change from time to time, so if a step doesn't look like this, ask Claude in a chat
   ("how do I connect Gmail?") or see Anthropic's
   [Claude in Chrome guide](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome).
3. **You: start a chat in the project** and paste this:

   ```
   Install Next Role from https://github.com/stephenpollock79/next-role
   Follow CLAUDE-INSTRUCTIONS.md in that repo, step by step.
   ```

4. **Claude takes it from there.** It asks your permission many times as it works (to read GitHub, write to your
   board, search the web): allow each one, and when it offers to always allow a tool, choose that so it asks less.
   It gives you your own copy of this checklist and ticks off each step as it's
   done:
   - **Publishes your board**: your own private copy, in your account.
   - **You: open the board once** from the link Claude gives you, in Chrome, and bookmark it. It makes its
     starting records, then shows Overview with a *Setup 0 of 12* card.
   - **Writes the reference material** onto the board, and saves the board's own link on it.
   - **Installs the 11 Next Role skills.** **You:** press Save on each skill card Claude shows you. A card may need
     Save pressed twice: it's saved when the card changes to say so.
   - **Gives you the project instructions and the board's code guide.** **You:** paste the instructions into
     the project's instructions, and add the guide to the project's files if Claude asks you to. Claude tells you
     where to click; both are on the right of the project's page.
   - **Makes your job-alerts label in Gmail**, and checks Claude in Chrome works.
   - **Runs the installation check**, a list of everything above, each marked done or not.
5. **You: open the board.** The setup wizard opens by itself (if you've closed it, press *Resume setup* at
   the top of the board). It walks you through the rest: your CV,
   what you want, the companies, where roles come from, a test sweep, your job alerts, and when Claude runs.

### If a step goes wrong

Tell Claude in the install chat what happened, or paste a screenshot, and ask it to help fix it. It can read this
repo and your board, and redo just the step that failed.

---

## How it works

Full instructions are in the board itself: **How to use**, at the bottom left of the screen. It covers how a week
runs, every page, and an FAQ you can search or ask Claude about.

---

## Changing your board

Next Role is yours to fix and extend. Ask Claude in your Next Role project: "the Week ahead page should…",
"add a field for…". It reads the board's code guide (`board-architecture.md`, added to your project at
installation) before touching any code, and keeps a list of your changes in it.

## Updating to a newer version

If a newer version is published here, ask Claude in your project: "update Next Role from
https://github.com/stephenpollock79/next-role". It replaces
the files you never changed, merges the ones you did (keeping your changes, and showing you before it
publishes), and offers the updated skills for you to save. Your data is never touched.
