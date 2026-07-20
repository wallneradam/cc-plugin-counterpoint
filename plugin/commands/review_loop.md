---
description: Autonomous Codex review-and-fix loop on a persistent thread (review, verify, fix, repeat until clean)
argument-hint: '[--scope auto|working-tree|branch] [--base <ref>] [--path <file-or-dir>]... [--effort <level>]'
allowed-tools: Bash, Read, Write, Agent
---

# Counterpoint Review Loop

Run an autonomous loop around the counterpoint `review` mode: review → verify each finding → fix the real ones → report back to Codex → re-review, until Codex approves or a safety cap is hit.

Parse `--scope`, `--base`, `--path` (repeatable), and `--effort` from $ARGUMENTS and pass them through to every review round. If the user names files or directories without flags, treat them as `--path` arguments.

What makes this loop different from re-running one-shot reviews: **every iteration continues the same persistent Codex thread.** Codex remembers its own findings by id, verifies claimed fixes in the actual code, and updates each finding's status (`resolved` / `still-open` / `revised` / `withdrawn`). A false positive rejected once stays withdrawn — it is never re-litigated. This makes convergence fast; most runs finish in 2–5 iterations.

## Mindset: Codex is one reviewer, not the source of truth

Codex findings are hypotheses. Every finding must be verified against the actual code before any fix is applied — false positives are routine, and applying them blindly makes the code worse. Disagreeing with Codex is fine and often correct: if a finding contradicts project conventions (CLAUDE.md / AGENTS.md), if the flagged behavior is intentional, or if the claim simply does not hold, classify it as a false positive and push back in the next round so Codex withdraws it.

## Architecture: orchestrator + per-iteration sub-agents

Do not run the whole loop inside one agent — a long loop accumulates context and degrades. The split is strict:

**The orchestrator** (you, the agent running this command):
- Prepares the workspace (see below).
- Spawns ONE per-iteration sub-agent at a time via the `Agent` tool, **synchronously: pass `run_in_background: false` EXPLICITLY**, `subagent_type: "general-purpose"`. Newer harnesses run agents in the background BY DEFAULT — omitting the flag detaches the worker, the orchestrator's turn ends, and the completion notification may never arrive, silently stalling the loop. A synchronous Agent call blocks and returns the worker's final JSON inline; a sub-agent taking 5–10+ minutes is normal — wait for it.
- Reads each sub-agent's JSON summary (returned as final message and written to `iteration-NN.json`).
- Decides continue/stop per the convergence rules.
- Prints EXACTLY the per-iteration progress output defined below — one stats line plus the worker's 1–3 sentence summary, nothing more — and, at the end, writes `final-summary.md` plus a 2–3 line closing summary.

The orchestrator is a relay, never a worker. It MUST NOT run the counterpoint CLI, read project source, verify or re-verify findings, apply fixes, run tests, or touch git — not even when a sub-agent fails or returns something odd. Taking over any part of the review/fix work in the main context is a protocol violation, full stop. Its only tools: `Bash` for workspace prep, `Read` for iteration JSONs, `Write` for `final-summary.md`, `Agent` for sub-agents. If a sub-agent returns something unparseable — including any claim that the review "is still running in the background" or "will continue automatically" (it will not; a returned sub-agent is finished) — re-spawn that same iteration once; if it fails twice, stop and report the error in the closing summary. Never fall back to doing the iteration yourself.

**The per-iteration sub-agent** has a clean context and does one round: run the review (or reply round), verify findings, fix real ones, write and return the summary JSON.

## Workspace

```
~/.claude/cache/counterpoint-review-loop/<repo-dir-name>-<UTC-timestamp>/
  iteration-01.json
  iteration-02.json
  ...
  final-summary.md
```

The workspace lives OUTSIDE the reviewed repository, always under `~/.claude/cache/` — never inside the repo. Loop artifacts (thread files, iteration JSONs) placed in the repo would show up as untracked changes and get reviewed by the loop itself. `<repo-dir-name>` is the basename of `git rev-parse --show-toplevel` (or of the working directory outside a repo).

**Wipe old runs at start — but never with a variable-glob `rm`.** Before creating the new run directory, delete every existing entry directly under `counterpoint-review-loop/`, nothing outside it. Do NOT write `rm -rf "$CACHE"/*` or any `rm -rf <var>/*` form: Claude Code's sandbox flags `rm -rf` on a possibly-empty variable path and prompts for confirmation, which stalls the loop in auto mode. Use `find` scoped to the parent instead — it targets each child by name, so an empty or unset parent can never expand into a catastrophic delete:

```
CACHE_PARENT="$HOME/.claude/cache/counterpoint-review-loop"
mkdir -p "$CACHE_PARENT"
find "$CACHE_PARENT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
mkdir -p "$CACHE_PARENT/<repo-dir-name>-<UTC-timestamp>"
```

The workspace doubles as the Codex thread home: sub-agents run the CLI with `CLAUDE_PLUGIN_DATA` pointing at the workspace, so the `.thread` file lives there and every iteration resumes the same Codex conversation. Keep the `iteration-NN.json` files for the whole run.

## Per-iteration sub-agent prompt

Substitute the bracketed placeholders. The prompt must be self-contained — pass only the previous iteration's JSON, never the conversation history.

```
You are iteration [N] of an autonomous counterpoint review-and-fix loop. Do ONE
round: run the Codex review (or reply round), verify each finding against the
code, fix the verified-real ones, and return a structured summary.

WORKING DIR: [absolute path]
WORKSPACE:   [absolute path to the per-run workspace dir]
PLUGIN ROOT: [absolute path to the counterpoint plugin root]
EXTRA REVIEW ARGS: [--scope/--base/--path/--effort flags passed to the command, or "none"]
USER LANGUAGE: [language the user converses in, e.g. "Hungarian"]

PREVIOUS ITERATION SUMMARY (literal "none" on iteration 1):
[previous iteration's JSON verbatim, or `none`]

CONTRACT: End your turn by writing iteration-[NN].json to the workspace AND
returning that exact JSON as your final message. On any failure (Codex missing,
timeout, unparseable output), still write and return the ERROR-shaped JSON —
never prose, never an empty message.

================ STEP 1: Run the review round ================

The CLI call resumes a persistent Codex thread stored in the workspace. A round
can run 15+ minutes — far beyond the foreground Bash cap — so launch it as ONE
background Bash call, then WAIT on it with blocking TaskOutput calls (below).
Never poll BashOutput, never sleep, and NEVER end your turn while it runs.

LAUNCH — a single Bash call with run_in_background: true AND
dangerouslyDisableSandbox: true (Codex needs network access and spawns its own
read-only sandbox; inside a sandboxed shell it dies silently, leaving no
process and no output). Redirect all output to a per-round log and append the
exit code, so completion state is readable from the file afterwards.

Iteration 1 (initial review):

  CLAUDE_PLUGIN_DATA="[workspace]" CODEX_COMPANION_SESSION_ID="loop" \
    node "[plugin root]/scripts/counterpoint.mjs" review [extra args] \
    > "[workspace]/cli-round-[NN].log" 2>&1; echo "EXIT:$?" >> "[workspace]/cli-round-[NN].log"

Iteration 2+ (reply round): compose a reply from the previous iteration's JSON —
one line per finding, addressed by Codex's finding id:
  - fixed real finding:   "F3: fixed — <what changed>"
  - unfixed real finding: "F5: not fixed — <why>"
  - false positive:       "F2: we classified this as a false positive — <concrete
                           reason>. Please verify and withdraw or defend it."
  - uncertain:            "F7: uncertain — <what is unclear>. <question to Codex>"
Then run (same background + redirect form):

  CLAUDE_PLUGIN_DATA="[workspace]" CODEX_COMPANION_SESSION_ID="loop" \
    node "[plugin root]/scripts/counterpoint.mjs" review [extra args] --reply "<the reply text>" \
    > "[workspace]/cli-round-[NN].log" 2>&1; echo "EXIT:$?" >> "[workspace]/cli-round-[NN].log"

WAIT — block on the background task with TaskOutput. Do NOT rely on being
"woken up" when the process exits: in a sub-agent, ending your turn means you
are FINISHED — nobody processes the finished round after you return. The wait
recipe, exactly:
  1. The background launch's tool result contains a task id. Load the
     TaskOutput tool if it is deferred: ToolSearch with query
     "select:TaskOutput".
  2. Call TaskOutput with that task id, block: true, timeout: 600000. The call
     returns when the process exits — or after 10 minutes if it is still
     running.
  3. If the task has not completed yet, call TaskOutput again with the same
     arguments. Repeat until the task reports completion. A round taking two
     or three blocking calls is normal. This repetition is NOT polling — each
     call blocks server-side; never substitute BashOutput checks or sleep.
  - NEVER write your final message while the round is still running. Returning
    with "the review continues in the background" is a protocol violation —
    nothing continues after you return. Your final message is the iteration
    JSON from STEP 4, nothing else, ever.

ON COMPLETION — read completion state from the files, not from process heuristics:
  - Success: [workspace]/counterpoint-loop-response.txt is NON-EMPTY. That file
    is Codex's response — parse it (the CLI truncates it at launch and writes
    it only on success, so non-empty means the round finished).
  - Failure: response file empty and/or the log's EXIT line is non-zero. The
    Codex thread is preserved across failed rounds, so re-run the SAME launch
    command ONCE (background, sandbox disabled, same blocking TaskOutput
    wait). If the retry also fails, write
    the ERROR-shaped JSON with error_kind "review-failed" and put the log tail
    in error_message.

The response is a fenced JSON block: verdict, summary, findings[] with id,
status, origin ("in-change" | "pre-existing"), severity (P1/P2/P3), title, file,
line_start/line_end, confidence, body, recommendation. Parse it; it is the
source of truth. "Nothing to review" output → write the empty summary and exit.
Open findings for this round = findings with status new / still-open / revised
(on iteration 1, everything). A "pre-existing" finding is a real bug in the
surrounding code that predates this change — Codex reports these as full
findings; treat them exactly like in-change findings, do not skip one because it
was already there.

================ STEP 2: Verify each open finding ================

Do NOT trust findings blindly; confidence scores are heuristic. For each open
finding, read the cited code and classify:
  - real: the file/lines match, the defect concretely manifests, and the fix
    does not violate project conventions (check CLAUDE.md / AGENTS.md).
  - false-positive: line drift, intentional behavior, convention-violating fix,
    or pure style preference. Note the concrete reason — it goes into the next
    round's reply so Codex can withdraw it.
  - uncertain: needs human judgement or missing context. Do not fix.

If Codex already withdrew or resolved a finding this round, do not re-verify it.

================ STEP 3: Fix verified-real findings ================

Apply fixes in-place. NEVER touch git (no add/commit/stash/reset) — the user
wants the diff reviewable. Fix verified-real "pre-existing" findings too, exactly
like in-change ones — being pre-existing is not a reason to leave a real bug
unfixed (this may extend the diff into code the change did not originally touch;
that is intended). Re-read each fix point afterwards. Targeted checks
(single test, linter on the file) are fine; full test suites are not. If a fix
would require an architecturally large change, reclassify as uncertain and
explain. For every real finding write a concrete 2-3 sentence change_summary
(what changed, where — or why not fixed).

================ STEP 4: Write the iteration summary ================

Write to [workspace]/iteration-[NN].json and return the same JSON.
All change_summary / error_message prose in USER LANGUAGE (with full
orthography); ids, paths, titles, enum values stay in English.

NORMAL shape:
{
  "iteration": [N],
  "status": "ok",
  "summary": "1-3 sentences in USER LANGUAGE: what this round found and what you did. The orchestrator prints this verbatim — write it for the user.",
  "verdict": "approve" | "needs-attention",
  "codex_resolved": ["F1", ...],
  "codex_withdrawn": ["F2", ...],
  "open_findings_count": <int>,
  "severity_counts": {"P1": <int>, "P2": <int>, "P3": <int>},
  "real": [
    {"id": "F3", "file": "...", "line_start": N, "line_end": N, "title": "...",
     "severity": "P1"|"P2"|"P3", "origin": "in-change"|"pre-existing", "fixed": true|false,
     "change_summary": "2-3 sentences, user language, single line"}
  ],
  "false_positives": [
    {"id": "F2", "file": "...", "line_start": N, "line_end": N, "title": "...",
     "severity": "...", "origin": "in-change"|"pre-existing", "change_summary": "why it is rejected — goes to Codex next round"}
  ],
  "uncertain": [
    {"id": "F7", "file": "...", "line_start": N, "line_end": N, "title": "...",
     "severity": "...", "origin": "in-change"|"pre-existing", "change_summary": "what is unclear and what would decide it"}
  ]
}
severity_counts covers all OPEN findings this round (real + fp + uncertain).

ERROR shape:
{
  "iteration": [N], "status": "error",
  "error_kind": "codex-missing" | "review-failed" | "timeout" | "result-unparseable" | "other",
  "error_message": "one line, user language"
}
```

## Convergence: when the orchestrator stops

Stop on any of:

1. **Approved.** `verdict: "approve"` — or every finding this round is resolved/withdrawn and nothing is open.
2. **Nothing fixable left.** Every open finding is false-positive or uncertain AND the previous round already reported the same set to Codex (i.e. Codex defended them twice). Escalate to the user instead of arguing forever.
3. **Stuck.** The set of open real findings (by id) is identical to the previous iteration's AND the current iteration applied no new fix (no `real` entry with `fixed: true`). If a fix WAS applied this round, always run at least one more iteration so Codex can verify it — never stop on a fix Codex has not yet re-inspected.
4. **Safety cap: 20 iterations.** The stateful thread converges fast; anywhere near 20 means something structural is wrong.

Otherwise spawn the next iteration with the new JSON.

## Progress output — strict, minimal, standardized

Everything the orchestrator prints is in the user's conversation language (ids, paths, titles, severity tags stay as-is). After each iteration, print EXACTLY two things and nothing else:

1. One standardized stats line built from the iteration JSON:

> Iteration N: X open [P1:a P2:b P3:c] | real: r (fixed: f) | false positive: p | uncertain: u | resolved: [ids] | withdrawn: [ids]

2. The worker's `summary` field, verbatim (it is already 1–3 sentences in the user's language).

That is the WHOLE per-iteration output. Do NOT list findings one by one, do NOT quote change_summary entries, do NOT narrate what you are about to do, do NOT explain the convergence decision — the details are all in `iteration-NN.json` and `final-summary.md` for anyone who wants them. Zero findings → stats line + summary only, same as any round.

After the loop, write `final-summary.md` (per-finding detail: fixes applied, unresolved findings, false positives — with the change_summary texts, in the user's language) and print a 2–3 line closing summary referencing it.

## Cautions

- Never touch git, in any agent. Non-negotiable.
- The orchestrator never reviews, verifies, or fixes anything itself — all real work happens in sub-agents. Its entire visible output per iteration is the stats line + the worker's summary; verbose narration or per-finding dumps in chat are protocol violations.
- The orchestrator must NEVER end its turn while an iteration is in flight. If a worker spawn accidentally went to the background (the Agent call returned a task id instead of the worker's final JSON), immediately block on it with repeated `TaskOutput` calls (block: true, timeout: 600000) until it completes — do not wait for a notification, it may never arrive.
- The counterpoint CLI needs the Codex CLI installed (`npm install -g @openai/codex`); if missing, the sub-agent reports `error_kind: "codex-missing"` and the loop stops.
- The CLI must never run inside a sandboxed Bash call — Codex needs network and its own sandbox. Sub-agents run it with `dangerouslyDisableSandbox: true`; a silently vanishing background process is the signature of a sandboxed launch.
- Sub-agents wait for the review round with repeated BLOCKING `TaskOutput` calls (block: true, timeout: 600000) on the background task — never by ending their turn (a returned sub-agent is finished; no wake-up comes), never by polling BashOutput or sleeping, and never by returning early with a "still running" message. Completion is judged from the response file (non-empty = done), not from process state.
- The loop's Codex thread lives in the workspace (`CLAUDE_PLUGIN_DATA` override), so it never disturbs the session's own counterpoint thread.
- Optional arguments (`--scope`, `--base`, `--path` (repeatable), `--effort`) pass through to every review round. With `--path` the loop reviews the listed files/directories as they exist on disk instead of a git diff.
- Workspace wipe MUST use the `find` recipe in the Workspace section — never `rm -rf "$CACHE"/*` or any `rm -rf <var>/*` form, even when preparing multiple workspaces for a multi-repo diff. That form trips Claude Code's "possibly-empty variable path" guard and prompts for confirmation, stalling the loop in auto mode.
