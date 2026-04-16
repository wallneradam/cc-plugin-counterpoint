---
name: counterpoint
description: >
  Stress-test plans, designs, and architectural decisions through actor-critic
  debate with Codex CLI via the counterpoint MCP server. ALWAYS use this skill before
  finalizing any implementation plan, architectural decision, or technical strategy.
  Use when planning, evaluating alternatives, making design trade-offs, choosing between
  approaches, or proposing feature structure. Use when the user asks for a second opinion,
  devil's advocate, or critique. Use during plan mode, design discussions, or before
  committing to a significant technical direction. Do NOT use for simple bug fixes,
  mechanical changes, single-line edits, or when the user says to skip debate.
allowed-tools: mcp__counterpoint__*, Read, Glob, Grep
---

# Counterpoint — Collaborative Review with Codex

Codex is a **source of outside perspective** — not a smarter entity, not an authority. Its core value is surfacing angles you haven't considered: blind spots, missed trade-offs, alternative framings. That is the reason to invoke it.

**Codex is not better-informed than you.** It has no access to the codebase, no view of the surrounding context, no memory of the user's constraints beyond what you put in the prompt. You have all of that. This asymmetry means Codex's suggestions are often generic where specific advice is needed, and sometimes simply wrong about this project.

**Default stance: every Codex observation is a hypothesis to validate in your context — not a verdict to apply.** Evaluate each point against the actual code and the real constraints before accepting it.

All interaction happens through the **`counterpoint` MCP server**, which maintains a persistent Codex thread across rounds. Codex remembers every prior round in the current session — that memory is the core value of the skill.

| MCP tool                              | Purpose                                                |
|---------------------------------------|--------------------------------------------------------|
| `mcp__counterpoint__critique`         | Review a concrete proposal                             |
| `mcp__counterpoint__consult`          | Think through an uncertain problem together            |
| `mcp__counterpoint__status`           | Check the active thread and auto-consult state         |
| `mcp__counterpoint__reset`            | Clear the thread (rare — only for fresh project context)|
| `mcp__counterpoint__auto_consult_on`  | Enable auto-consult mode                               |
| `mcp__counterpoint__auto_consult_off` | Disable auto-consult mode                              |

## Tool selection — critical

**Always use the `mcp__counterpoint__*` tools directly.** Do NOT substitute:

- ❌ Do NOT call `codex-rescue` or any other Codex agent — those create fresh, disconnected sessions every time and lose the multi-round context that makes counterpoint useful.
- ❌ Do NOT shell out to `node .../counterpoint.mjs` — the CLI exists only as a fallback; the MCP tools are the intended interface.
- ✅ Call `mcp__counterpoint__critique` / `mcp__counterpoint__consult` directly with the `proposal` or `question` argument.

Counterpoint = iterative peer dialogue with thread memory. Rescue = one-shot delegated hand-off. They serve different purposes — don't conflate them.

## Auto-Consult Mode

The user can toggle auto-consult with `/consult_on` and `/consult_off`. When active, you MUST consult Codex on **every significant decision** — not just when explicitly asked.

Check whether auto-consult is active by calling `mcp__counterpoint__status`. If `autoConsult` is `true`, follow the auto-consult rules from the `/consult_on` command instructions. If `false`, use the normal "When to use" guidelines below.

## When to use

- Before finalizing an implementation plan → `critique`
- When evaluating multiple design alternatives → `consult`
- During plan mode discussions → `critique` or `consult`
- Before committing to architectural decisions → `critique`
- When unsure about the best approach → `consult`
- When the user asks for a second opinion → `critique`
- **When auto-consult is ON** → consult or critique on every non-trivial action

## When NOT to use

- Simple bug fixes with obvious solutions (unless auto-consult is ON)
- Mechanical changes (renaming, formatting)
- Single-line edits or trivial refactors
- When the user explicitly says: "skip counterpoint", "no debate", "just do it"

## Reasoning Effort

Control how deeply Codex thinks via the `effort` argument. Choose based on decision weight:

| Effort     | When to use                                                                |
|------------|----------------------------------------------------------------------------|
| `medium`   | Default. Most design decisions, API choices, data modeling                 |
| `high`     | Architecture-level decisions, security-critical design, complex trade-offs |
| `xhigh`    | Foundational decisions that are very hard to reverse later                 |
| `low`      | Quick sanity checks, minor design details                                  |

If unsure, leave `effort` unset (uses Codex's default) or pass `"medium"`. Only escalate to `high`/`xhigh` when the decision has long-term or wide-reaching consequences.

## Debate Protocol — organic, not fixed rounds

The debate between you and Codex runs as **as many rounds as genuinely useful, and no more**. There are no mandatory rounds. After each Codex response, decide whether another round is worth it.

**Run all rounds within a single invocation. Do NOT pause to ask the user between rounds — the user sees only the final synthesis.**

### Codex's questions are YOUR questions to answer

When Codex raises a concern, asks for clarification, or requests information about the codebase, **you resolve it yourself** — do NOT forward Codex's questions to the user. You have the full toolset (Read, Grep, Glob, Bash, etc.) and direct access to the code; Codex does not. Treat Codex's questions as research prompts for you to investigate.

- ❌ Wrong: "Codex asks whether the auth module uses JWT or sessions — could you tell me?"
- ✅ Right: Run `Grep` for auth patterns, find the answer, feed it back to Codex in the next round.

Only escalate to the user when:
- The question genuinely requires a product/business decision only the user can make (priorities, scope, preferences).
- Information is not derivable from code, git history, or available tools.
- A real ambiguity exists about the user's intent that affects the outcome.

The user sees the final synthesis, not the back-and-forth. Don't break that contract by routing Codex's questions through them.

### Opening the debate

**For `critique`** — you have a concrete proposal. Frame it as:
- **Goal**: What are we trying to achieve?
- **Approach**: How will we achieve it?
- **Trade-offs**: What are we giving up?
- **Key decisions**: What are the critical choices?

Call `mcp__counterpoint__critique` with the structured proposal.

**For `consult`** — you are unsure. Frame it as:
- **Context**: What are we building, what constraints exist?
- **Uncertainty**: What specifically are you unsure about?
- **Options you see**: What approaches have you considered so far?

Call `mcp__counterpoint__consult` with the framing.

### Evaluating Codex's response — critical review is the default

Every Codex observation is a **hypothesis you must validate**, not a verdict you apply. Run each point through these filters before accepting it:

- **Specificity**: Does this apply to *this* codebase, or is it generic best-practice advice detached from context?
- **Evidence**: Does Codex have information that supports this concern — or is it extrapolating from the prompt alone? (Usually the latter. Codex cannot see the code.)
- **Real vs. theoretical risk**: Is the risk actually present here, or a textbook worry that doesn't materialize in this design?
- **Novelty**: Is this a genuinely new angle, or something you already weighed and dismissed for good reason?
- **Misunderstanding**: Did Codex misread part of the proposal? If yes, correct it in the next round — don't accept a critique built on a wrong premise.
- **Reflex vs. reasoning**: Is the suggestion grounded in real trade-offs specific to your situation, or a reflex preference ("use X instead of Y")?

**Defend your position when you believe you're right.** Agreement must come from being convinced by the substance — not from deference to Codex's tone of authority. Many Codex suggestions will fail one or more filters above; reject those explicitly ("doesn't apply here because…") and move on. Disagreement stays respectful, never dismissive — but it stays firm.

**The goal is new perspective, not validation.** If Codex only echoes or polishes your plan without surfacing something you hadn't seen, the round added no value — note that and stop.

### Deciding to continue

**Continue** when:
- Codex raised a substantive concern and you have a real answer or counter-argument.
- An OPEN QUESTION from Codex actually matters for the outcome.
- A new angle emerged that you haven't explored together yet.
- You disagree with Codex on something material and want to resolve it.

**Stop** when:
- You've reached consensus, or the remaining differences are taste/preference.
- Codex's latest response is mostly confirmation without new content.
- Further rounds would only polish, not change the outcome.
- The user's original question is sufficiently answered.

### Continuing a round

Codex remembers everything. Send **only the delta**, not the full proposal/question:

- Critique: `"Addressed X by [change]. Kept Y because [reason]. On your concern about Z — I think it doesn't apply here because [specific reason]. Still open: [if any]."`
- Consult: `"Leaning toward [X] because [reason]. Not convinced by [Codex's suggestion] because [reason]. Still unsure about [specific aspect]."`

### Synthesis — what the user sees

After the debate ends, present the user with a concise summary. The intermediate rounds stay hidden unless the user explicitly asks for them.

**For critique:**
1. **Final plan** — the refined, review-tested version
2. **New angles Codex surfaced** — perspectives you had not considered, that genuinely changed the plan
3. **Codex concerns I rejected** — points that failed the validation filters (not specific enough, theoretical risk, misread the proposal, etc.), with explicit reasoning
4. **Where Codex and I differed** — any unresolved disagreements, with your reasoning
5. **Accepted risks** — things Codex flagged that you chose to keep, and why

**For consult:**
1. **Decision** — what you settled on
2. **New angles Codex surfaced** — what perspectives it contributed that shaped the decision
3. **Codex suggestions I rejected** — explicit list with reasoning, to make the filtering visible
4. **Why** — your overall reasoning
5. **Open questions** — anything worth flagging that the discussion didn't resolve

The synthesis reflects **your** mediated judgment, not just Codex's opinion echoed back.

## Session Management — Codex remembers everything

The MCP server maintains a **persistent Codex thread** within a Claude Code session. This has important implications:

**Within a debate (rounds 1-3):**
- Codex sees the full conversation history — every prior round in the current debate.
- In Round 2+, do NOT resend the full proposal. Only send what changed and why. Codex already has the original.
- Example Round 2 message: "Addressed your concerns: switched from SQLite to PostgreSQL for write concurrency. Kept Redis for presence. Added CRDT snapshotting strategy every 100 ops." — NOT the entire plan again.

**Across debates (multiple planning sessions):**
- The thread persists across all debates in a single Claude Code session.
- Codex accumulates context from all prior debates in the project.
- You can reference earlier debates: "Similar to what we discussed for the auth module, but applied to the payment flow."
- This means later debates are richer — Codex understands the project's evolving architecture.

**When to reset:**
- Only call `mcp__counterpoint__reset` when starting a completely unrelated project context or when the thread becomes too long/confused.
- Do NOT reset between debates within the same project — the accumulated context is valuable.

## Error Handling

If an MCP tool call fails (Codex not installed, timeout, etc.):
- Report the error to the user
- Suggest running `npm install -g @openai/codex` if Codex is missing
- Continue with your plan but note it was not stress-tested
