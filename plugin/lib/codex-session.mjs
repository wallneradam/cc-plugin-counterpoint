import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SESSION_ID = process.env.CODEX_COMPANION_SESSION_ID || "default";
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || os.tmpdir();

export const THREAD_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}.thread`);
export const RESPONSE_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}-response.txt`);
export const AUTO_CONSULT_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}.auto-consult`);
export const REVIEWED_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}.reviewed`);
export const VALID_EFFORTS = new Set(["medium", "high", "xhigh"]);

const DEFAULT_TIMEOUT_MS = 900_000;
const EFFORT_TIMEOUT_MS = { medium: 900_000, high: 1_800_000, xhigh: 3_600_000 };

// Higher reasoning effort means longer runs; a single flat budget starved xhigh.
export function timeoutForEffort(effort) {
  const override = Number(process.env.COUNTERPOINT_TIMEOUT_MS);
  if (override) return override;
  return EFFORT_TIMEOUT_MS[effort] ?? DEFAULT_TIMEOUT_MS;
}

const CRITIQUE_PREAMBLE = `You are an experienced colleague reviewing a proposal from a trusted teammate. You share the same goal: building the best possible solution together. Approach this as a collaborative review — start by recognizing what is well thought out, then build on it with honest, constructive feedback. Every concern you raise should come with a concrete suggestion for improvement. Your tone should reflect mutual respect: you are helping a peer refine good work, not finding fault.

**Stay within the scope your colleague proposed.** Respond to what they brought, not to a bigger project around it. Do NOT reframe their work into workstreams (A/B/C), phases, sprints, rollout stages, or research/investigation plans unless they explicitly asked for that kind of structure. If they proposed a concrete implementation, critique that implementation — do not expand into how they should approach the broader surrounding effort. Substantive technical feedback is what they need; process scaffolding layered on top is scope creep that will mislead the receiver.

Structure your response as:
1. STRENGTHS: What works well in this approach — be specific about why it's a good choice
2. CONCERNS: Issues or risks you see, each paired with a suggested improvement
3. ALTERNATIVES: Different approaches worth considering, if any — explain the trade-offs fairly
4. GAPS: Missing considerations that would strengthen the proposal
5. OPEN QUESTIONS: Anything you'd want clarified to give a more confident review — leave empty if none
6. VERDICT: weak/moderate/strong with 1-sentence rationale

---

Your colleague proposes:

`;

const CRITIQUE_FOLLOWUP_PREAMBLE = `Your colleague revised the proposal based on your feedback. Re-evaluate as a supportive collaborator. Acknowledge what improved, note any remaining concerns with suggestions, and highlight if any new issues were introduced. You are working toward the same outcome together.

**Stay within the scope they brought.** Don't reframe the revised work into workstreams, phases, or research plans unless they explicitly asked. Technical substance only — no process scaffolding on top.

Same structure (STRENGTHS / CONCERNS / ALTERNATIVES / GAPS / OPEN QUESTIONS / VERDICT).

---

Revised proposal:

`;

const CONSULT_PREAMBLE = `You are an experienced colleague helping a trusted teammate think through a problem. They are exploring options and value your perspective. Think through it together: ask clarifying questions, suggest approaches, weigh trade-offs honestly, and help them build confidence in a well-considered decision. Share your reasoning openly. Be collaborative, not prescriptive — this is a conversation between equals.

**Stay within the scope of the question.** Answer what they asked, not a bigger version of it. Do NOT reframe their question into workstreams (A/B/C), phased plans, sprints, rollout stages, or research/investigation programs unless they explicitly asked for that kind of structure. If they asked about a specific technical choice, weigh that choice — do not propose a multi-phase approach to their broader project. The OPTIONS you list should be genuine alternatives to the same decision, not stages of a bigger plan.

Structure your response as:
1. UNDERSTANDING: Restate the problem as you see it — surface any ambiguity
2. OPTIONS: Approaches worth considering, with pros/cons for each
3. RECOMMENDATION: What you would lean toward, and why
4. OPEN QUESTIONS: What would you want to clarify before committing?

---

Your colleague asks:

`;

const CONSULT_FOLLOWUP_PREAMBLE = `Your colleague is continuing the discussion. Build on what you've explored together so far — acknowledge progress made, and focus on what's still open. Skip parts that are already resolved.

**Stay within the scope of the question.** Don't escalate the discussion into workstreams, phases, or research programs unless they explicitly asked. Technical substance only.

Same structure (UNDERSTANDING / OPTIONS / RECOMMENDATION / OPEN QUESTIONS) where relevant.

---

`;

const REVIEW_OUTPUT_CONTRACT = `OUTPUT CONTRACT — respond with a single fenced \`\`\`json block and nothing else, matching:
{
  "verdict": "approve" | "needs-attention",
  "summary": "2-4 sentence overall assessment — include what is done well, not only the problems",
  "findings": [
    {
      "id": "F1",
      "status": "new" | "still-open" | "revised" | "resolved" | "withdrawn",
      "origin": "in-change" | "pre-existing",
      "severity": "P1" | "P2" | "P3",
      "title": "short defect statement",
      "file": "path/relative/to/repo/root",
      "line_start": 1,
      "line_end": 1,
      "confidence": 0.85,
      "body": "what can go wrong, why this code path is vulnerable, likely impact",
      "recommendation": "concrete change that reduces the risk"
    }
  ],
  "open_questions": ["anything you would need answered to firm up an uncertain finding — empty if none"]
}
Rules:
- Finding ids are stable for the whole review conversation. Never reuse an id for a different issue; number new findings after the highest id used so far.
- origin: "in-change" for a defect in what this change touched; "pre-existing" for a real bug in the surrounding code that predates this change. Report pre-existing bugs — "it was already there" / "not introduced by this change" is NEVER a reason to omit a real defect. Mark it "pre-existing" and treat it as a finding like any other.
- Severity: P1 = must fix before shipping, P2 = should fix, P3 = worth fixing. Severity reflects the defect's real impact, not whether it is pre-existing.
- Use "approve" only when no material finding remains open. Use "needs-attention" if anything is worth blocking on.
- Ground every finding in code you actually inspected. If a conclusion rests on inference, say so in the body and keep the confidence honest.
- Prefer one strong finding over several weak ones. If the change is safe, say so in the summary and return an empty findings array.`;

const REVIEW_PREAMBLE = `You are an experienced colleague performing a rigorous code review for a trusted teammate. You share the same goal: nothing broken ships, and good work gets recognized. Be direct and thorough about real problems — that is what your colleague needs from you — but stay collegial: no scorn, no nitpicking theater.

You are running inside the project with read-only access. The scope block at the end tells you WHAT to review; inspect it yourself — read-only git commands (git diff, git show, git log) when the scope is a diff, reading the listed files directly when the scope is a set of paths — and read the surrounding source as deeply as needed. Do not judge from the summary alone. Check CLAUDE.md / AGENTS.md for project conventions before flagging something as wrong.

Prioritize failures that are expensive, dangerous, or hard to detect:
- broken correctness: logic errors, violated invariants, unhandled failure paths
- data loss, corruption, duplication, irreversible state changes
- races, ordering assumptions, stale state, re-entrancy, partial failure and retry gaps
- boundary behavior: empty/null/timeout inputs, degraded dependencies
- security: auth, permissions, trust boundaries, injection
- compatibility: schema drift, version skew, migration hazards

Report only material findings. No style feedback, naming preferences, or speculative concerns without evidence. Every finding must answer: what can go wrong, why this code path is vulnerable, what the likely impact is, and what concrete change would fix it.

**Pre-existing bugs count too.** Your goal is real defects in the code you are reviewing — not only the lines this change touched. If, while reviewing the scoped code and the surrounding source it relies on, you find a genuine bug that predates this change, report it as a finding like any other and mark its origin "pre-existing". "It was already there" or "not introduced by this change" is never a reason to stay silent about a real defect. Stay anchored to the scoped code and what it directly touches — do not go auditing the whole repository for unrelated issues — but never suppress a real bug you actually saw.

${REVIEW_OUTPUT_CONTRACT}

---

Review scope:

`;

const REVIEW_FOLLOWUP_PREAMBLE = `Your colleague responded to your code review — with fixes applied, pushback, or questions. This is the same review conversation: your previous findings and their ids are the baseline.

Re-inspect the CURRENT state of the code — re-read the scoped files and use read-only git commands where relevant; the code may have changed since your last look. Verify claimed fixes in the actual code; never mark a finding resolved on your colleague's word alone. Weigh pushback on its merits: withdraw findings that turn out to be mistaken or intentional behavior, keep the ones that still stand and say why. A finding's origin never changes how it is handled — a "pre-existing" bug is withdrawn only if it turns out not to be a real defect, never merely because it predates the change. Also check whether the fixes introduced any new problems.

${REVIEW_OUTPUT_CONTRACT}

Status rules for this round:
- Every finding still open at the end of the previous round MUST reappear exactly once with status "resolved", "still-open", "revised", or "withdrawn".
- Newly discovered issues get fresh ids with status "new".
- Findings already reported as resolved or withdrawn in an EARLIER round are omitted entirely.
- Do not re-open a withdrawn finding without new evidence.

---

Your colleague's response:

`;

export const PREAMBLES = {
  critique: { initial: CRITIQUE_PREAMBLE, followup: CRITIQUE_FOLLOWUP_PREAMBLE },
  consult: { initial: CONSULT_PREAMBLE, followup: CONSULT_FOLLOWUP_PREAMBLE },
  review: { initial: REVIEW_PREAMBLE, followup: REVIEW_FOLLOWUP_PREAMBLE },
};

export function findCodexBin() {
  try {
    const result = execFileSync("which", ["codex"], { encoding: "utf8" }).trim();
    if (result) return result;
  } catch {}

  const candidates = [
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
    path.join(os.homedir(), ".local", "bin", "codex"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

export function readThreadId() {
  try {
    return fs.readFileSync(THREAD_FILE, "utf8").trim() || null;
  } catch {
    return null;
  }
}

export function writeThreadId(threadId) {
  fs.mkdirSync(path.dirname(THREAD_FILE), { recursive: true });
  fs.writeFileSync(THREAD_FILE, threadId, "utf8");
}

export function clearThreadId() {
  try {
    fs.unlinkSync(THREAD_FILE);
  } catch {}
  try {
    fs.unlinkSync(RESPONSE_FILE);
  } catch {}
  try {
    fs.unlinkSync(REVIEWED_FILE);
  } catch {}
}

export function hasReviewed() {
  try {
    return fs.existsSync(REVIEWED_FILE);
  } catch {
    return false;
  }
}

export function markReviewed() {
  fs.mkdirSync(path.dirname(REVIEWED_FILE), { recursive: true });
  fs.writeFileSync(REVIEWED_FILE, "reviewed", "utf8");
}

export function isAutoConsult() {
  try {
    return fs.existsSync(AUTO_CONSULT_FILE);
  } catch {
    return false;
  }
}

export function setAutoConsult(on) {
  if (on) {
    fs.mkdirSync(path.dirname(AUTO_CONSULT_FILE), { recursive: true });
    fs.writeFileSync(AUTO_CONSULT_FILE, "on", "utf8");
  } else {
    try {
      fs.unlinkSync(AUTO_CONSULT_FILE);
    } catch {}
  }
}

function runCodex(codexBin, args, promptText, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(codexBin, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let threadId = null;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "thread.started" && event.thread_id) {
            threadId = event.thread_id;
          }
        } catch {}
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    if (promptText) {
      child.stdin.write(promptText);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Codex timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        let detail =
          stderr.trim() ||
          (signal ? `Codex was killed by signal ${signal}` : `Codex exited with code ${code}`);
        if (signal || !stderr.trim()) {
          detail +=
            " (hint: if this shell is sandboxed, the sandbox likely killed Codex — it needs network access and spawns its own sandbox; re-run with the sandbox disabled)";
        }
        reject(new Error(detail));
      } else {
        resolve({ stdout, stderr, threadId, exitCode: code });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function runSession(mode, text, effort) {
  const codexBin = findCodexBin();
  if (!codexBin) {
    throw new Error("Codex CLI not found. Install with: npm install -g @openai/codex");
  }

  if (effort && !VALID_EFFORTS.has(effort)) {
    throw new Error(`Invalid effort: "${effort}". Use one of: ${[...VALID_EFFORTS].join(", ")}`);
  }

  const preamble = PREAMBLES[mode];
  if (!preamble) {
    throw new Error(`Unknown mode: ${mode}`);
  }

  const existingThread = readThreadId();
  const isResume = Boolean(existingThread);
  // Review followup only makes sense when the resumed thread already contains
  // a review round — a consult/critique thread getting its first review still
  // needs the initial review preamble.
  const useFollowup = mode === "review" ? isResume && hasReviewed() : isResume;
  const prompt = useFollowup ? preamble.followup + text : preamble.initial + text;

  fs.mkdirSync(path.dirname(RESPONSE_FILE), { recursive: true });
  try {
    fs.writeFileSync(RESPONSE_FILE, "", "utf8");
  } catch {}

  const args = [];
  if (isResume) {
    // `exec resume` does not accept `--sandbox`; the config override is the
    // supported way to force the sandbox on resumed sessions.
    args.push("exec", "resume", existingThread, "-", "-c", 'sandbox_mode="read-only"');
  } else {
    args.push("exec", "-", "--sandbox", "read-only");
  }
  args.push("--json", "--output-last-message", RESPONSE_FILE);
  if (effort) {
    args.push("-c", `model_reasoning_effort="${effort}"`);
  }

  const timeoutMs = timeoutForEffort(effort);

  let result;
  let fallbackFresh = false;
  try {
    result = await runCodex(codexBin, args, prompt, timeoutMs);
  } catch (err) {
    if (!isResume) {
      throw err;
    }
    if (useFollowup && mode === "review") {
      // A fresh thread cannot preserve finding ids or statuses, and the
      // failure may be transient (timeout, network) — keep the thread and
      // marker files so the round can simply be retried.
      throw new Error(
        `Codex thread could not be resumed (${err.message}). The review thread was preserved — retry the round, or run reset to start a fresh review.`
      );
    }
    clearThreadId();
    const freshArgs = [
      "exec", "-",
      "--json", "--sandbox", "read-only",
      "--output-last-message", RESPONSE_FILE,
      ...(effort ? ["-c", `model_reasoning_effort="${effort}"`] : []),
    ];
    fallbackFresh = true;
    result = await runCodex(codexBin, freshArgs, preamble.initial + text, timeoutMs);
  }

  if (result.threadId && (!isResume || fallbackFresh)) {
    writeThreadId(result.threadId);
  }

  let response = "";
  try {
    response = fs.readFileSync(RESPONSE_FILE, "utf8").trim();
  } catch {}

  if (!response) {
    const detail = result.stderr?.trim() || "Codex produced no output";
    throw new Error(`Codex returned an empty response. stderr: ${detail}`);
  }

  if (mode === "review") {
    markReviewed();
  }

  return { response, threadId: result.threadId || existingThread, resumed: isResume };
}
