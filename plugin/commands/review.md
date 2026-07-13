---
description: Code review of the local git state with Codex (multi-round, stateful findings)
argument-hint: '[--scope auto|working-tree|branch] [--base <ref>] [--path <file-or-dir>]... [focus areas...]'
allowed-tools: mcp__counterpoint__*, Read, Glob, Grep, Bash(git:*)
---

Run a Codex code review via the `mcp__counterpoint__review` MCP tool, following the review protocol in the counterpoint skill.

Argument handling:
- If $ARGUMENTS contains `--scope <value>` or `--base <ref>`, pass them as the `scope` / `base` tool parameters.
- Each `--path <file-or-dir>` goes into the `paths` array parameter — path-based review of the listed files/directories as they exist on disk, independent of git state (use this for already-committed code or whole modules). If the user names files or directories to review without flags, treat those as `paths` too.
- Any remaining text in $ARGUMENTS is the `focus` parameter (optional review focus areas).

Protocol (see the counterpoint skill's "Review mode" section for the full rules):
1. Call `mcp__counterpoint__review` with the parsed parameters.
2. Parse the JSON findings from the response. Summarize them in chat — one line per finding (`id severity file:line — title`), plus the verdict. The user cannot see the raw MCP result.
3. **Verify each finding against the actual code** before accepting it (Read/Grep the cited locations). Classify: real / false positive / uncertain — and say so in chat.
4. This command is **review-only**: do NOT fix anything unless the user asks. If there are false positives or you have pushback, send a follow-up round via the `reply` parameter so Codex re-evaluates and updates finding statuses.
5. If the user wants findings fixed automatically, point them to `/counterpoint:review_loop`.

Do NOT delegate to `codex-rescue` or any other Codex agent — the persistent thread is what makes multi-round review work.
