---
name: counterpoint
description: >
  Collaborative review and problem-solving with Codex CLI via the counterpoint MCP server.
  Invoke ONLY when the user explicitly asks — through `/counterpoint`, `/consult`, or a direct
  request for a second opinion. Do NOT invoke proactively, do NOT invoke "before finalizing",
  do NOT treat any other situation as a trigger.
allowed-tools: mcp__counterpoint__*, Read, Glob, Grep
---

# Counterpoint — Collaborative Review with Codex

## When to invoke

**Only when the user explicitly asks.** Examples:

- `/counterpoint <proposal>` — critique mode
- `/consult <question>` — consult mode
- "Ask Codex what it thinks", "Get a second opinion", "Run this by Codex"

That's it. Do NOT invoke:

- Before finalizing plans
- Before architectural decisions
- When you sense a tradeoff
- Because the situation "feels" non-trivial

If the user did not ask, do not invoke.

## What Codex is — and is not

Codex is a **source of outside perspective**, not an authority. It has no access to the codebase, no view of project context beyond what you put in the prompt. Its observations are **hypotheses for you to validate against the actual code** — not verdicts to apply.

| MCP tool                        | Purpose                                 |
|---------------------------------|-----------------------------------------|
| `mcp__counterpoint__critique`   | Review a concrete proposal              |
| `mcp__counterpoint__consult`    | Think through an uncertain problem      |
| `mcp__counterpoint__status`     | Check the active thread                 |
| `mcp__counterpoint__reset`     | Clear the thread (rare)                 |

Always use these MCP tools directly. Do NOT substitute `codex-rescue` or any other Codex agent — those create disconnected one-shot sessions and lose the thread memory that makes counterpoint useful.

## Critical: the user does not see Codex's raw response

MCP tool results are visible to **you only**. The user sees nothing of what Codex returned unless you put it in your chat reply.

**Protocol after every counterpoint call:**

1. Write a **short summary in chat** (3–8 bullets, plain prose). Capture: Codex's main points, the strongest concern, anything new it surfaced. Skip filler, skip Codex's section headers, skip restating your own proposal.
2. **Only reference points that appear in your summary** in the rest of your reply. Do not allude to "as Codex noted…" about anything you did not put in the summary — to the user, that reference is invisible context.
3. Then state your reaction: what you accept, what you push back on, and why.

If the summary would be longer than ~10 bullets, your summary is too detailed — compress further. The user wants a digest, not a transcript.

## Reasoning effort

Pass `effort` to control how deeply Codex thinks:

| Effort   | When to use                                                                |
|----------|----------------------------------------------------------------------------|
| `medium` | Default. Most design decisions, API choices, data modeling                 |
| `high`   | Architecture-level decisions, security-critical design, complex trade-offs |
| `xhigh`  | Foundational decisions that are very hard to reverse later                 |

`medium` is the minimum. If unsure, omit `effort` and let Codex use its default.

## Multi-round debate is the point

A single Codex round is rarely the end of the conversation. The whole reason this plugin exists is **iterative dialogue** — disagreement, clarification, pushback, refinement. The persistent thread means Codex remembers prior rounds; only send the delta in round 2+.

**After each round, decide whether another is worth it.** Continue when:

- Codex raised a concern you have a real counter-argument for — push back and see what it says.
- Codex misread part of the proposal — correct it and ask it to re-evaluate.
- A new angle emerged that neither of you has explored yet.
- You disagree on something material and want to resolve it, not paper over it.

**Stop** when:

- You've converged, or remaining differences are taste/preference.
- Codex's latest response is mostly confirmation without new content.
- The user's original question is sufficiently answered.

There is no fixed round count — but if the conversation ended after Round 1 and you didn't try a second round, ask yourself why. A single back-and-forth is the floor for any non-trivial topic, not the ceiling.

### Round visibility — every round shows up in chat

Each round = one MCP call + one chat-visible summary (per the "user does not see raw response" rule above). The user should see the dialogue evolve: round 1 summary → your pushback → round 2 summary → your reaction → and so on. Do not silently chain rounds and present only a final synthesis — that hides the substance the user is here to see.

If you anticipate ~3 rounds, that's three visible summaries in chat, not one.

### Codex's questions are yours to answer

When Codex asks about the codebase ("does the auth module use JWT?"), **investigate it yourself** with Read/Grep/Glob and feed the answer back in the next round. Do not forward Codex's questions to the user — Codex cannot see the code, you can.

Only escalate to the user when the question is a genuine product/business decision, not a code-fact question.

### Defending your position

Agreement must come from being convinced by substance, not deference to Codex's confident tone. Run each Codex point through these filters before accepting:

- **Specificity** — does it apply to *this* code, or is it generic best-practice?
- **Evidence** — does Codex have grounds, or is it extrapolating from the prompt alone?
- **Real vs. theoretical risk** — would this actually happen here?
- **Misunderstanding** — did Codex misread part of the proposal?

Reject points that fail these filters explicitly: "doesn't apply here because…" — and say so in your chat summary so the user sees the filtering.

### Scope discipline — Codex's framing is not your scope

Common failure mode: Codex wraps technical content in unrequested workstream/phase/sprint framings, and you adopt it because it looks structured. **The user's original ask defines the scope.** Strip out workstreams, phases, rollout plans, research programs that the user did not request — keep only the technical substance.

If Codex's framing genuinely adds value, surface it as an explicit option to the user, do not silently inherit it.

### Continuing a round

Codex remembers everything. Send **only the delta**:

- Critique: "Addressed X by [change]. Kept Y because [reason]. On Z — I think it doesn't apply because [specific reason]. Still open: [if any]."
- Consult: "Leaning toward [X] because [reason]. Not convinced by [your suggestion] because [reason]. Still unsure about [aspect]."

## Final synthesis

When the debate converges, give the user a brief wrap-up:

**Critique:**
- Final plan (what you'll do)
- New angles Codex surfaced that genuinely changed the plan
- Codex points you rejected and why
- Any unresolved disagreements

**Consult:**
- The decision
- What Codex contributed that shaped it
- What you rejected and why
- Open questions still worth flagging

The synthesis is **your** mediated judgment, not Codex's opinion echoed back.

## Session persistence

The MCP server keeps a persistent Codex thread per session. Within a session, every call resumes the same thread — Codex sees prior debates and accumulates project context. Only call `reset` when switching to an unrelated project or when the thread becomes confused.

## Error handling

If an MCP call fails (Codex not installed, timeout, etc.):

- Tell the user what failed.
- Suggest `npm install -g @openai/codex` if Codex is missing.
- Continue without counterpoint — note that the decision was not stress-tested.
