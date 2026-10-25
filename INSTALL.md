# Installing Next Role

Everything you need to install Next Role in your own Claude account and get it running. Back to the
[overview](README.md).

## What you'll need

| | |
| --- | --- |
| **A paid Claude plan** | Pro or above. Next Role runs as scheduled tasks and uses Claude in Chrome, both on paid plans. |
| **Usage** | In testing, a normal week (two sweeps, a morning run every day and one weekly check) used about half of a Pro plan's weekly allowance, on a busy board. Expect less on a new board, with the sweep on Sonnet. Pro leaves little room for other Claude use, so if you already use Claude a lot, consider Max. Running the morning run on weekdays only saves about a fifth. |
| **Gmail** | For job-alert emails. If you'd rather not use your main address, make a free Gmail just for job alerts. No Gmail at all? It still works: the sweep reads job sites and company pages directly, and alert-only sites become ones you check yourself. |
| **Claude in Chrome** | The browser extension. Setup uses it to create your job alerts on LinkedIn and other sites, in your own signed-in browser. |
| **Your CV** | As a Word file (.docx), plus a cover letter if you have one. |
| **LinkedIn connections export** *(optional)* | For Warm routes: people you know at the companies you want. LinkedIn takes about a day to send it, so request it early: LinkedIn › Settings › Data privacy › Get a copy of your data › Connections. |

**Time:** installation about 30 minutes. Setup about 3 to 5 hours of your time over a day or two, in a guided
wizard on the board; Claude does its parts in the background while you carry on.

---

## Install

Do these in order. Claude does most of the work; you do the parts marked **You**.

1. **You: make a Claude Project** called *Next Role* (claude.ai › Projects › New project). Everything to do with
   your search happens in chats inside this project. Only give it a name: leave the description, instructions and
   files empty. Claude gives you the instructions to paste, and the file to add, in step 4.
2. **You: connect Gmail** to Claude (click your initials at the bottom left › Settings › Connectors › Gmail), and **install Claude in Chrome**.
   Claude in Chrome is a Chrome extension, not a connector, so it won't show up in a Connectors search. Install it
   from the Chrome Web Store in the Chrome you'll use for your search, and sign it in with the same Claude account
   ([how](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)).
3. **You: start a chat in the project** and paste this:

   ```
   Install Next Role from https://github.com/stephenpollock79/next-role
   Follow CLAUDE-INSTRUCTIONS.md in that repo, step by step.
   ```

4. **Claude takes it from there.** It gives you your own copy of this checklist and ticks off each step as it's
   done:
   - **Publishes your board**: your own private copy, in your account.
   - **You: open the board once** when Claude says. It makes its starting records.
   - **Writes the reference material** onto the board, and saves the board's own link on it.
   - **Installs the 11 Next Role skills.** **You:** press Save on each skill card Claude shows you.
   - **Gives you the project instructions and the board's code guide.** **You:** paste the instructions into
     the project's instructions, and add the guide to the project's files if Claude asks you to.
   - **Makes your job-alerts label in Gmail**, and checks Claude in Chrome works.
   - **Runs the installation check**, a list of everything above, each marked done or not.
5. **You: open the board and press *Set up the board*.** The setup wizard walks you through the rest: your CV,
   what you want, the companies, where roles come from, a test sweep, your job alerts, and when Claude runs.

### If a step goes wrong

- **Claude can't reach GitHub:** download this repo as a ZIP (green *Code* button › Download ZIP), attach it to
  the chat, and say "install from the attached ZIP instead".
- **A skill card didn't save:** say "show me the next-role skill cards again".
- **The installation check shows something not done:** say "fix the failed installation steps". Claude redoes
  just those.
- **Anything else:** ask in the project chat. Claude can read this repo and the board, and fix most things.

---

## How a week works

- **The sweep** (twice a week, evenings): Claude reads your job alerts, job sites and the companies' own jobs
  pages, screens every role against your deal-breakers, and puts the rest on your **Longlist**.
- **You** score each Longlist role for **Fun** and **Shot** (about a minute a role) and send the good ones on.
- **The morning run** (daily): Claude checks roles are still open, researches what you shortlisted, drafts CVs
  and cover letters for roles at **To apply**, and preps your interviews.
- **You** decide, apply, and go to interviews. **Insights** and **Search review** show what to change when the
  search stalls.

---

## Changing your board

Next Role is yours to fix and extend. Ask Claude in your Next Role project: "the Week ahead page should…",
"add a field for…". It reads the board's code guide (`board-architecture.md`, added to your project at
installation) before touching any code, and keeps a list of your changes in it.

## Updating to a newer version

Ask Claude in your project: "update Next Role from https://github.com/stephenpollock79/next-role". It replaces
the files you never changed, merges the ones you did (keeping your changes, and showing you before it
publishes), and offers the updated skills for you to save. Your data is never touched.
