# Counterpoint — Claude Code Plugin

Collaborative review and problem-solving plugin for Claude Code. Pairs Claude with Codex CLI as trusted colleagues who refine plans, explore alternatives, and stress-test decisions together.

## How it works

Two modes for different situations:

### Critique — review a proposal together

1. **Claude** formulates a structured proposal
2. **Codex** reviews it — acknowledges strengths, raises concerns with suggestions, identifies gaps
3. Claude **refines** based on the feedback
4. Repeat until the plan is solid (2-3 rounds)

### Consult — think through a problem together

1. **Claude** describes the problem and uncertainty
2. **Codex** explores options, weighs trade-offs, shares a recommendation
3. They **narrow down** together through follow-up discussion
4. Claude arrives at a well-considered decision

Both modes produce a clear synthesis for the user.

## Installation

Requires [Codex CLI](https://github.com/openai/codex):

```bash
npm install -g @openai/codex
```

Install the plugin into Claude Code:

```bash
claude plugin add /path/to/cc-plugin-counterpoint
```

## Usage

### Slash command

```
/counterpoint <plan or proposal to review>
```

### Skill (auto-triggered)

The skill activates automatically before finalizing implementation plans, architectural decisions, or technical strategies. It chooses `critique` or `consult` mode based on context. Skip with "no debate" or "just do it".

### Script (direct)

```bash
node scripts/counterpoint.mjs critique [--effort <level>] "<proposal>"
node scripts/counterpoint.mjs consult [--effort <level>] "<question>"
node scripts/counterpoint.mjs status
node scripts/counterpoint.mjs reset
```

## Reasoning effort levels

Control how deeply Codex thinks. Choose based on decision weight:

| Level    | When to use                                              |
|----------|----------------------------------------------------------|
| `low`    | Quick sanity checks, minor design details                |
| `medium` | Default — most design decisions, API choices             |
| `high`   | Architecture-level decisions, security-critical design   |
| `xhigh`  | Foundational decisions that are very hard to reverse     |

## Session persistence

Codex maintains a persistent thread within a Claude Code session. All discussions — both critique and consult — share the same thread, so Codex accumulates project context over time. Later conversations are richer because Codex understands prior decisions.

Use `reset` to clear the thread when switching to an unrelated project.

## Design philosophy

The interaction between Claude and Codex is always **collaborative and respectful**. Codex acts as a trusted colleague — it recognizes good ideas, builds on them, and raises concerns constructively. This approach produces better outcomes than adversarial "find the flaws" prompting.

## License

MIT
