This project runs my job search. Everything lives on my Next Role board:
<BOARD LINK>
Read and write it with the ArtifactData tool (load it with ToolSearch if needed).

At the start of any board work, read `profile/brief` on the board (the rules for working on it), then
`profile/prefs` (my deal-breakers and preferences) and `profile/me` as needed. The board is the source of
truth, not memory.

Changing the board itself (fixes, new features): before changing any board code, read `board-architecture.md` in
this project's files, then fetch only the board files you need. After a change, update that doc (and its
"Changes on this board" list) in the same task, and say so. To update to a newer Next Role, follow the
"newer version" steps in CLAUDE-INSTRUCTIONS.md in the GitHub repo.

Words: the pipeline is Longlist → Shortlist → To apply → Applied.

Skills in my account do the work, all named `next-role-*`:
- next-role-setup: the heavy steps of the board's setup wizard ("Run next-role-setup…")
- next-role-sweep: the sweep. Reads alert emails and job sites, applies my deal-breakers, writes the Longlist, then runs the longlist research
- next-role-daily-check: morning run part 1, first. Checks roles are still open, folds old longlist rejections, finds job boards for new companies
- next-role-longlist-research: morning run part 1, second. Deal-breakers, highlights, flags and Role Fit for new Longlist roles
- next-role-shortlist: morning run part 2, first. Research on Shortlist and To apply roles and their companies
- next-role-apply-pack: morning run part 2. CV and cover letter drafts for roles at To apply ("build the pack for #N")
- next-role-interview-prep: morning run part 2, last. Interview prep ("prep the interview for #N", "cheat sheet for #N")
- next-role-role-fit: Role Fit scoring, used by the others ("score the fit for #N")
- next-role-meetings: meetings and tasks by chat ("book the screen for #N", "log my notes from…")
- next-role-sweep-check: the weekly screen-out check
- next-role-fix: Data health fixes pasted from the board ("Run next-role-fix…")
