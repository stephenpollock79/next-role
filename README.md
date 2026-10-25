# Next Role

**An app that helps you find the right role, apply for it and prepare for the interviews.** It lives in your
own Claude account: you open it in your browser or the Claude app, and Claude does the legwork on a schedule
while you make the decisions.

**What it does**

- **Finds roles** from your job-alert emails, job sites and the companies you want to work for.
- **Screens them against your preferences**, so the roles that reach you fit what you want, each with a Role
  Fit score against your CV.
- **Researches** the roles you shortlist and their companies.
- **Helps you apply** with a CV and cover letter tailored to each role, as tracked changes you accept or reject.
- **Prepares you for interviews**: prep for each round and a one-page cheat sheet.
- **Shows what's working**: analytics on your search funnel, with suggestions to improve it.
- **Tools** to plan your week, find people who could recommend you, compare roles side by side and run mock
  interviews.

**How it works**

- **What it never does:** apply for you, send anything, or decide for you. You score every role, choose what
  to apply for, and send everything yourself.
- **No server, no app to host.** The board is a page in your own Claude account, its data lives there too,
  and Claude's own scheduled tasks do the work. Nothing is sent anywhere else.
- **Yours to change.** Ask Claude to fix something or add a feature, and it does, on your copy.

Built during a self-directed sabbatical in AI-native product management, and used for my own job search
throughout. I'm a product manager: I directed this build rather than hand-wrote it. Free for personal use.

## Demo video

https://github.com/user-attachments/assets/784f4a59-3242-44e6-af2d-5afe3da487a5

## Try it

**[Open the demo board](https://stephenpollock79.github.io/next-role/demo/)**: the real board, with made-up data
for a made-up product designer. No sign-in. Click anything; your changes stay in your own browser, and Reset
puts it back. The parts where Claude does the work are switched off in the demo.

## Install it

**[Follow the installation guide](INSTALL.md)**, step by step, on a computer.

You'll need a paid Claude plan (Pro or above; a normal week used about half of Pro's weekly allowance in testing),
the Claude desktop app, Gmail for job alerts, the Claude in Chrome extension and your CV. About 30 minutes to install,
then a guided setup on the board. The guide covers each step, what to do if one goes wrong, how a week works, and
changing or updating your board.

## How I built it

**Time.** About three weeks, part time.

**Process.** Built for my own search first, one feature at a time, used daily from the start → a feature
freeze and a full QA pass → personal details moved out of the code and into the board's data → a test board,
a guided setup wizard and this demo → packaged here so anyone can install their own.

**Scale.** About 18,000 lines of JavaScript in 52 files, 11 Claude skills, over 600 published versions, and
about 560 automated checks in the QA pass.

**How it's tested.** Every change runs the real board code headless against real data with a mocked Claude,
and compares every page before and after. A personal-data scan runs before anything is published.

**Tools.**

| Tool | Used for |
| --- | --- |
| Claude | the build itself, and the product: the board is a Claude artifact with its own database |
| Claude skills | the 11 `next-role-*` skills that do the work: sweep, research, Role Fit, CV packs, interview prep |
| Claude scheduled tasks | the twice-weekly sweep, the morning run and the weekly checks |
| Claude in Chrome | creating job alerts on LinkedIn and other sites during setup |
| Gmail | job-alert emails, read by the sweep |
| Playwright and headless Chromium | regression testing every change |
| GitHub | source, and the demo (GitHub Pages) |

**What it cost me to build.** This is the build, not what you'd pay to use it: for that, see
[what you'll need](INSTALL.md#what-youll-need).

| Item | Cost |
| --- | --- |
| Claude subscription | Max, 5× tier. Next Role uses nothing else |
| Hosting, database, APIs | None: it all runs inside Claude |

## What I learned

The practices and rules that came out of my builds are written up in my playbook:

- [Best practices](https://github.com/stephenpollock79/stephenpollock79/blob/main/playbook/best-practices.md): what I'd recommend and what I'd avoid
- [My AI rules](https://github.com/stephenpollock79/stephenpollock79/blob/main/playbook/ai-rules.md): how I set up AI to act on its own and stop when it should

## What's in this repo

| | |
| --- | --- |
| [`INSTALL.md`](INSTALL.md) | The installation guide |
| [`CLAUDE-INSTRUCTIONS.md`](CLAUDE-INSTRUCTIONS.md) | What Claude follows to install Next Role, including the installation check |
| `board/` | The board itself: `index.html`, `js/`, `css/` |
| `skills/` | The 11 `next-role-*` skills Claude uses |
| `install/` | Reference material written onto your board at installation, and the project instructions |
| `examples/scheduled-tasks.md` | The four scheduled tasks setup creates, for reference |
| `docs/board-architecture.md` | How the board's code is organised: the guide Claude reads before changing it |
| `docs/demo/`, `demo/`, `tools/` | The demo board and how it's built |

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE.md): free for personal use, including your own job search. You can't
sell it or build a paid product or service on it. Not open source.

---

Built by [Stephen Pollock](https://github.com/stephenpollock79).
