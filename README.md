# Next Role

**A job-search board that runs inside Claude.** Claude finds roles, screens them against your deal-breakers,
researches the ones you shortlist, drafts tailored CVs and cover letters, and preps your interviews, on a
schedule, while you make the decisions. Free for personal use.

- **See it first:** [the demo board](https://stephenpollock79.github.io/next-role/demo/) (made-up data for a made-up designer; your changes stay in your own browser, and Reset puts it back).
- **What it does:** finds roles from job-alert emails, job sites and the companies you want; screens every
  role against your deal-breakers; gives each one a Role Fit score against your CV; researches roles and
  companies; drafts a tailored CV and cover letter as tracked changes; preps each interview round, with mock
  interviews and cheat sheets; and tells you, every week, where your search is stuck.
- **What it never does:** apply for you, send anything, or decide for you. You score every role, choose what
  to apply for, and send everything yourself.
- **Your data stays in your own Claude account.** The board is a page in your account; nothing is sent
  anywhere else.

---

## What you'll need

| | |
| --- | --- |
| **A paid Claude plan** | Pro or above. Next Role runs as scheduled tasks and uses Claude in Chrome, both on paid plans. |
| **Usage** | A normal week is two sweeps, a morning run every day and one weekly check. The aim is for that to fit in about half of a Pro plan's weekly usage. *Early estimate, being confirmed: one sweep, the heaviest run, uses roughly a tenth of Pro's weekly usage on Sonnet.* Start with two sweeps a week and adjust. |
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
   your search happens in chats inside this project.
2. **You: connect Gmail** to Claude (Settings › Connectors › Gmail), and **install Claude in Chrome**
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
   - **Gives you the project instructions.** **You:** paste them into the project's instructions.
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

## What's in this repo

| | |
| --- | --- |
| `CLAUDE-INSTRUCTIONS.md` | What Claude follows to install Next Role, including the installation check |
| `board/` | The board itself: `index.html`, `js/`, `css/` |
| `skills/` | The 11 `next-role-*` skills Claude uses |
| `install/` | Reference material written onto your board at installation: the rules Claude follows on the board (`brief.json`), the skills list, job-site reading notes, and the CV-editing script |
| `install/project-instructions.md` | The text for your Claude Project's instructions |
| `examples/scheduled-tasks.md` | The four scheduled tasks setup creates, for reference |
| `docs/board-architecture.md` | How the board's code is organised, for anyone changing it |
| `docs/demo/`, `demo/`, `tools/` | The public demo board and how it's built |

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE.md): **free for personal use**, including your own job search. You can't
sell it or build a paid product or service on it. Not open source.

Made by Stephen Pollock.
