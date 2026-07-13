# Counterpoint — Claude Code Plugin

Manual collaborative review and problem-solving plugin for Claude Code. Pairs Claude with Codex CLI as a trusted colleague — Claude calls Codex **only when you explicitly ask**, holds an iterative multi-round dialogue with it, and surfaces a brief summary of Codex's response in chat after every round.

## How it works

Three modes for different situations:

### Critique — review a proposal together

1. **Claude** formulates a structured proposal
2. **Codex** reviews it — acknowledges strengths, raises concerns with suggestions, identifies gaps
3. Claude **summarizes** Codex's response in chat and refines based on the feedback
4. Repeat for as many rounds as the topic genuinely needs

### Consult — think through a problem together

1. **Claude** describes the problem and uncertainty
2. **Codex** explores options, weighs trade-offs, shares a recommendation
3. They **narrow down** through follow-up rounds, with each Codex response summarized in chat
4. Claude arrives at a well-considered decision

### Review — stateful code review of your git changes

1. The plugin resolves the review scope from git (working tree if dirty, otherwise branch diff against the default branch — or an explicit `--scope` / `--base`), or reviews explicitly listed files/directories as they exist on disk (`--path`, repeatable) — useful for already-committed code, whole modules, or anything a diff can't express
2. **Codex** inspects the actual diff and surrounding code itself (read-only) and returns structured findings: stable id, severity (P1–P3), file/lines, confidence, concrete recommendation, plus an approve / needs-attention verdict
3. **Claude** verifies every finding against the code before accepting it — findings are hypotheses, not verdicts
4. After fixes or pushback, the next round continues the **same Codex thread**: Codex re-inspects the current code, verifies the claimed fixes itself, and updates each finding's status (`resolved` / `still-open` / `revised` / `withdrawn`). A false positive rejected once stays withdrawn.

For hands-off cleanup there is an autonomous loop (`/counterpoint:review_loop`): review → verify → fix → report back to Codex → re-review, repeated until Codex approves or the loop converges. Each iteration runs in a fresh sub-agent, but all iterations share one persistent Codex review thread — which is why it converges in a few rounds instead of re-litigating the same findings forever.

Each round produces a visible summary in chat — you see the dialogue evolve, not just the final synthesis.

## Installation

Requires [Codex CLI](https://github.com/openai/codex):

```bash
npm install -g @openai/codex
```

Register the marketplace and install the plugin (run these inside Claude Code):

```
/plugin marketplace add /path/to/cc-plugin-counterpoint
/plugin install counterpoint@cc-plugin-counterpoint
```

Install the MCP server's Node dependencies (once, in the plugin directory):

```bash
cd /path/to/cc-plugin-counterpoint/plugin
npm install
```

After the first install, Claude Code auto-starts the counterpoint MCP server and the `mcp__counterpoint__*` tools become available.

## Usage

Invocation is **always explicit**. Claude does not call Codex on its own — it waits for you.

### Slash commands

```
/counterpoint <plan or proposal to review>
/consult <question or problem to explore>
/review [--scope auto|working-tree|branch] [--base <ref>] [--path <file-or-dir>]... [focus areas...]
/review_loop [--scope ...] [--base <ref>] [--path <file-or-dir>]... [--effort <level>]
/reset
```

Or simply ask: "Get a second opinion on this", "Run this by Codex", "What does Codex think?".

### MCP tools (primary interface — Claude calls these directly)

- `mcp__counterpoint__critique` — review a proposal
- `mcp__counterpoint__consult` — think through a question
- `mcp__counterpoint__review` — code review of the local git state (structured findings, multi-round statuses)
- `mcp__counterpoint__status` — active thread
- `mcp__counterpoint__reset` — clear thread

### Script (fallback / debug)

The CLI wrapper is kept for manual inspection:

```bash
node plugin/scripts/counterpoint.mjs critique [--effort <level>] "<proposal>"
node plugin/scripts/counterpoint.mjs consult [--effort <level>] "<question>"
node plugin/scripts/counterpoint.mjs review [--scope auto|working-tree|branch] [--base <ref>] [--path <file-or-dir>]... [--effort <level>] [--reply "<text>"] ["focus..."]
node plugin/scripts/counterpoint.mjs status
node plugin/scripts/counterpoint.mjs reset
```

## Reasoning effort levels

Control how deeply Codex thinks. Choose based on decision weight:

| Level    | When to use                                              |
|----------|----------------------------------------------------------|
| `medium` | Default — most design decisions, API choices             |
| `high`   | Architecture-level decisions, security-critical design   |
| `xhigh`  | Foundational decisions that are very hard to reverse     |

`medium` is the minimum accepted level.

## Session persistence

Codex maintains a persistent thread within a Claude Code session. All discussions — critique, consult, and review — share the same thread, so Codex accumulates project context over time. Later conversations are richer because Codex understands prior decisions, and a review after a design consult starts with the design already in context. (The review loop is the exception: it runs on its own isolated thread inside its workspace.)

Use `reset` to clear the thread when switching to an unrelated project.

## Design philosophy

The interaction between Claude and Codex is always **collaborative and respectful**. Codex acts as a trusted colleague — it recognizes good ideas, builds on them, and raises concerns constructively. This produces better outcomes than adversarial "find the flaws" prompting.

Equally important: Codex is **a perspective, not an authority**. In critique and consult modes it sees only the prompt; in review mode it reads the repo, but its findings are still hypotheses to validate against the actual project — accepted on substance, rejected with explicit reasoning when they don't apply.

## License

MIT
