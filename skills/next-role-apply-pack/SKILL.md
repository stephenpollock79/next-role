---
name: "next-role-apply-pack"
description: "Builds the CV and cover letter pack for a Next Role board role at To apply: stores a summary of the job ad, then a tracked-change .docx starting draft on the board. Never applies or sends. Run by a scheduled task, or \"build/revise the pack for #N\"."
---

# Application pack

Turns a role at **To apply** into a tailored CV and cover letter, with every edit visible as a Word
tracked change, stored on the board, plus a short list on the card saying what changed and why. **The
user downloads them from the card as a starting draft, finishes them outside the board, applies, and
uploads the versions they sent** to `finals/<roleId>`. Aim at a strong first draft, not a finished
document. Revisions are asked for in chat.

It also **stores a summary of the job ad** on every role at To apply or later (`adSummary`, section 2b),
because ads come down, often right after the user applies. The mock interview, interview prep and this
pass all read it.

## Where everything lives

**The board is the source of truth.** This pass has no access to the user's files. Read and write the
board with the artifact database tool (`ArtifactData`). The board's URL comes from the scheduled task's
prompt or the project's instructions; if neither gives one, stop and say so.

| What | Where on the board |
| --- | --- |
| Board rules (where each fact goes, Keep it short, the words to use) | `profile/brief` — read it first, every run; it binds every write |
| Who the user is: `name`, `stories` with numbers, fixed `positioning`, what they don't have (`gaps`), interview watch-outs (`watchOuts`), `links`, writing `voice` | `profile/me` |
| What the user wants | `profile/prefs` |
| Skills evidence | `profile/skills` |
| Limits (edit counts, sent versions to compare, letter length) | `profile/settings`; a missing value means use the default below |
| Base CV and letter | `templates/cv`, `templates/letter` (`b64`, `name`, `sha256`; `text` is for other skills) |
| Roles, companies | `roles`, `companies` |
| Packs built, versions the user sent | `packs`, `finals` |
| The redline script | `refs/redline` (`py`, `sha256`) |

The user names roles by number: `#N` is the role's `ref`.

**Empty board.** If `templates/cv` or `templates/letter` is missing, say so in one line and stop (an ad
summary still gets written, section 2b). If no role needs a pack or an ad summary, stop: no log, no
report, no notification.

## What this pass must not do

1. **Never invent experience.** Every claim must trace to the template CV, to a pack already on the
   board (`packs`), to a version the user sent (`finals`), or to `profile/me`. Reword, reorder and
   emphasise; never add a number, employer, product, scope or skill that is not there. Nothing in
   `profile/me` `gaps` is ever claimed or implied, however close the role is to it, and the `watchOuts`
   still apply.
2. **Never apply, send, email or change `stage`.** The only writes are `packs/<roleId>` (and its backup
   on a revision) and the role's `pack` and `adSummary` fields. **Never write `finals/*` or the role's `final` field**:
   those are the user's uploads.
3. **Never edit the templates.** `templates/cv` and `templates/letter` are read-only to this skill.
4. **Never make an edit silently.** Every change is a tracked change (the script guarantees this), and
   every change appears in `pack.cvChanges` or `pack.letterAngle`.

## 1. Pick the roles

Read `roles`. Build a pack for each role where `stage` is `prep` **and** `pack` is empty.

**Ad summary:** every role where `stage` is `prep`, `applied` or `offer` **and** `adSummary` is empty
gets one (section 2b), whether or not it needs a pack. For a role getting a pack, write it first, so the
pack can use it.

**Revisions happen only on demand in chat** ("revise the pack for #N: …"), with the user's notes in the
message. The scheduled run never revises. If the role already has a `final`, say so before revising:
the user has probably finished it themselves.

## 2. Read what the role needs

- the role row: `title`, `company`, `url`, `enrich.summary`, `enrich.openQuestions`, `highlights`,
  `green`, `red`, `g2Note`, and on a revision the user's notes from the chat;
- the company row in `companies` (by `companyId`): `sector`, `ai`, `culture`, `questions`;
- **the posting itself**: `pasted` when the user pasted the ad, else the page at `url`, for its own words.
  If it cannot be read, say so in `pack.gaps` and work from the row and its `adSummary` if one exists;
- `profile/prefs` (what the user wants) and `profile/me` (who they are, stories with numbers);
- **the user's sent versions**: the most recent `finals/<roleId>` docs, up to `profile/settings`
  `pack.finalsToCompare` (default 3) (`cv`, `letter`, each {name, mime, size, sha256, at} plus either
  `assetId` or, on older uploads, `b64`; Word or PDF). **`assetId`** (uploads since 5 Oct): the file is in
  the board's file store, not the record. Fetch it with the Artifact tool — `action: "read"`, the board
  `url`, `path: "<assetId>"` (one id per call; `paths` does not fetch assets) — which saves it locally and
  reports its sha256; check that against the stored `sha256`. **`b64`**: decode it as in section 3.
  Compare each with that role's pack: what they kept, cut and reworded is their voice and judgment. Lean
  the new pack that way. Extract text from a .docx with `redline.py text`, from a PDF with `pdftotext`
  if present;
- `profile/skills` (top skills, each with one line of CV evidence) and the role's `fit` (the ad's
  requirements, matched). **The met must-haves decide what the profile and skills column lead with;
  each must-have gap goes into `pack.gaps`**, never covered over.

## 2b. Store the ad summary

When a role needs one (section 1), read the ad: `pasted` when it holds the ad's text, else the
employer's own posting at `url` (from a LinkedIn link, find the same role on the employer's careers site;
never use a logged-in LinkedIn session). Then update the role (pin `if_version`), field `adSummary` only:

```json
"adSummary": {
  "purpose": "Why the role exists: the problem it solves, in the ad's terms.",
  "scope": "What the person owns, team shape, reporting line, who they work with.",
  "product": "The product and its users or customers.",
  "responsibilities": ["Up to 6, in the ad's words"],
  "success": "Outcomes or metrics the ad names, if any.",
  "process": "The hiring process the ad describes, if any.",
  "notable": ["Up to 4 other specifics an interviewer may raise: a tool, a way of working, a market"],
  "from": "posting" | "pasted",
  "url": "<the page read, when from the posting>",
  "at": "YYYY-MM-DD"
}
```

- **Only what the ad says.** Leave a field out rather than guess; no advice, no fit judgement (that is
  Role Fit's job).
- `profile/brief`'s **Keep it short** rules bind every field: a paragraph field is two sentences at most,
  a list item under about 12 words. About 1,500 characters in all.
- **The ad can't be read** (gone, login, blocked): write nothing, say so in the report and, for a pack,
  in `pack.gaps`. Ask nothing of the user; they get a copy from the company if they need it.
- Never overwrite an existing `adSummary`. The user can ask in chat for it to be redone.

**Positioning is fixed.** The title line, years of experience and any job titles `profile/me` marks as
fixed stay exactly as stated. Tailoring happens in the profile, the ordering of skills and bullets, and
the cover letter, never by renaming the user.

## 3. Get the files into the workspace

Fetch `redline.py` from the board (section 9). Then, with ArtifactData:

- **New pack:** read `templates/cv` and `templates/letter`. Each has `b64`, `name`, `sha256`.
- **Revision:** read `packs/<roleId>`; start from its `cv.b64` / `letter.b64` (the current version, so
  the user's accepted direction carries forward), not the template. Only rework the document(s) the
  notes mention.

Decode to `.docx` and **check the sha256 of the decoded bytes matches the stored `sha256`**; if not,
stop and report it. A corrupted template must never become a pack.

```bash
python3 - <<'PY'
import base64, hashlib, json
d = json.load(open("tpl_cv.json"))          # the doc saved with ArtifactData out_dir
d = d.get("data", d)
b = base64.b64decode(d["b64"]); assert hashlib.sha256(b).hexdigest() == d["sha256"]
open("cv.docx", "wb").write(b)
PY
```

Names: `<Name> CV - <Company>.docx` and `<Name> Cover Letter - <Company>.docx`, with `<Name>` the
user's name from `profile/me`; a revision adds ` v2`, ` v3`.

## 4. Read the exact wording

```bash
python3 redline.py text cv.docx
```

**Edits must quote this text exactly**, including curly apostrophes (’) and en dashes (–).

## 5. Decide the edits

**CV — usually `profile/settings` `pack.cvEditsMin` to `pack.cvEditsMax` edits (default 3 to 8):**
- **The profile's first paragraph**: the one edit every pack makes. Keep its first clause (the fixed
  title and years) and point the rest at what this role asks for, using only facts from the CV.
- **Skills column**: swap in the role's vocabulary where a listed skill is the same thing under another
  name, and move the most relevant ones up by rewording, not by deleting lines.
- **One or two experience bullets**: sharpen the one that proves the role's main ask. Numbers stay
  exactly as they are.
- Nothing else. A CV that has changed everywhere reads as generic.

**Cover letter — always:**
- the greeting and the "I'm applying for…" line: company and exact role title;
- **the paragraph on what interests the user about the role**: rewritten for this role, from the
  posting and the shortlist research: the one real problem the role exists to solve and why it suits
  them;
- the template's domain paragraphs: keep, trim or reorder emphasis; never add claims;
- **replace any link placeholder in the template** with the matching link from `profile/me`;
- the user's writing voice as `profile/me` describes it; no longer than `profile/settings`
  `pack.letterMaxPages` (default 1) page.

**On a revision**, the notes the user gives in chat decide the edits; everything above still binds. If a
note asks for something rule 1 forbids, don't do it and say why in `pack.gaps`.

Edits JSON:

```json
[
  {"find": "Dear <Template company> team,", "replace": "Dear <Company> team,"},
  {"find": "anchor text", "insert_after": " added text"}
]
```

Use `"occurrence": N` if a phrase repeats. A `find` must sit inside one paragraph.

## 6. Apply as tracked changes

```bash
python3 redline.py apply cv.docx cv.docx edits-cv.json --author "Claude"
```

**Any line starting `REFUSED` means that edit did not happen:** fix the `find` against step 4's output
and re-run it; never paper over it. Then run `redline.py text` on the result and read it back once. If
LibreOffice (`soffice`) is available, render the letter once to check it is still within the page limit;
if not, say so in `pack.gaps`.

## 7. Store the files on the board

1. **Revision only:** copy the current `packs/<roleId>` to `packs/<roleId>-v<n>` (n = the version it
   held, starting at 1) before overwriting. Never delete an older version.
2. Build the doc in a local JSON file and write it with ArtifactData `set` (`file_path`, pinned with
   `if_version` when it exists):

```json
{"builtAt": "YYYY-MM-DD", "version": 1,
 "cv":     {"name": "<Name> CV - <Company>.docx", "size": 0, "sha256": "...", "b64": "..."},
 "letter": {"name": "<Name> Cover Letter - <Company>.docx", "size": 0, "sha256": "...", "b64": "..."}}
```

`size` and `sha256` are of the final bytes. Then **read it back and check both sha256 values** against
your local files. A pack that doesn't round-trip is not finished.

## 8. Write the "what changed" to the role

Follow `profile/brief`'s **Keep it short** rules for `letterAngle`, each `cvChanges` item and each
`gaps` item. Update the role (pin `if_version`), field `pack` only:

```json
{
  "builtAt": "YYYY-MM-DD",
  "stored": "board",
  "cv": "<Name> CV - <Company>.docx",
  "letter": "<Name> Cover Letter - <Company>.docx",
  "cvChanges": [ {"what": "Profile now leads on ...", "why": "The ad's first requirement is ..."} ],
  "letterAngle": "One or two sentences: the argument the letter makes for this role.",
  "gaps": ["Things the role asks for that the CV cannot honestly claim, or checks the user should make"]
}
```

Never touch `stage`, `final`, `fun`, `shot` or any field other than `pack` (and `adSummary`, section 2b).

**Report:** one short block per role: role number and title, CV edit count, the letter's angle in a
sentence, the gaps. Lead with any gap that could sink the application. Then one line listing the roles
that got an ad summary, and any whose ad couldn't be read.

## 9. redline.py

The script lives on the board as `refs/redline` (fields `py`, `sha256`). Read it with ArtifactData,
write `py` to `redline.py` byte for byte, and check its sha256 matches before running it. If it doesn't,
stop and report; never patch the script on the fly. Standard library only, no install needed.

## Related

- `next-role-shortlist` researches the role before it reaches To apply; `next-role-interview-prep`
  picks it up after.
- Board: `templates/*` (the user uploads them on About me › My CV & letter; each also has a `text` copy
  for the other skills to read as evidence; this skill tailors from `b64`, never from `text`),
  `packs/*`, `finals/*` (the user's sent versions, uploaded on the Pack tab or an Applied card's Sent
  tab), the role's To apply card.
- `next-role-role-fit` and `profile/skills`: what the role asks for and what the user can prove.
- Board doc `refs/skills`: the manifest of every `next-role-*` skill.