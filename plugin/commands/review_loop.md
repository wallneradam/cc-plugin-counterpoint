---
description: Autonomous Codex review-and-fix loop on a persistent thread (review, verify, fix, repeat until clean)
argument-hint: '[--scope auto|working-tree|branch] [--base <ref>] [--path <file-or-dir>]... [--effort <level>]'
allowed-tools: Bash, Read, Write, Agent
---

Run the **counterpoint-review-loop** skill.

Pass any `--scope`, `--base`, `--path` (repeatable), or `--effort` arguments from $ARGUMENTS through to every review round. If the user names files or directories without flags, pass them as `--path` arguments.

Follow the skill exactly: orchestrator + one foreground sub-agent per iteration, verify findings before fixing, never touch git, stop on the skill's convergence rules.
