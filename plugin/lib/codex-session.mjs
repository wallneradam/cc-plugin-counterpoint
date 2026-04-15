import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SESSION_ID = process.env.CODEX_COMPANION_SESSION_ID || "default";
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || os.tmpdir();

export const THREAD_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}.thread`);
export const RESPONSE_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}-response.txt`);
export const AUTO_CONSULT_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}.auto-consult`);
export const TIMEOUT_MS = Number(process.env.COUNTERPOINT_TIMEOUT_MS) || 900_000;
export const VALID_EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh"]);

const CRITIQUE_PREAMBLE = `You are an experienced colleague reviewing a proposal from a trusted teammate. You share the same goal: building the best possible solution together. Approach this as a collaborative review — start by recognizing what is well thought out, then build on it with honest, constructive feedback. Every concern you raise should come with a concrete suggestion for improvement. Your tone should reflect mutual respect: you are helping a peer refine good work, not finding fault.

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

Same structure (STRENGTHS / CONCERNS / ALTERNATIVES / GAPS / OPEN QUESTIONS / VERDICT).

---

Revised proposal:

`;

const CONSULT_PREAMBLE = `You are an experienced colleague helping a trusted teammate think through a problem. They are exploring options and value your perspective. Think through it together: ask clarifying questions, suggest approaches, weigh trade-offs honestly, and help them build confidence in a well-considered decision. Share your reasoning openly. Be collaborative, not prescriptive — this is a conversation between equals.

Structure your response as:
1. UNDERSTANDING: Restate the problem as you see it — surface any ambiguity
2. OPTIONS: Approaches worth considering, with pros/cons for each
3. RECOMMENDATION: What you would lean toward, and why
4. OPEN QUESTIONS: What would you want to clarify before committing?

---

Your colleague asks:

`;

const CONSULT_FOLLOWUP_PREAMBLE = `Your colleague is continuing the discussion. Build on what you've explored together so far — acknowledge progress made, and focus on what's still open. Skip parts that are already resolved.

Same structure (UNDERSTANDING / OPTIONS / RECOMMENDATION / OPEN QUESTIONS) where relevant.

---

`;

export const PREAMBLES = {
  critique: { initial: CRITIQUE_PREAMBLE, followup: CRITIQUE_FOLLOWUP_PREAMBLE },
  consult: { initial: CONSULT_PREAMBLE, followup: CONSULT_FOLLOWUP_PREAMBLE },
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
    fs.writeFileSync(AUTO_CONSULT_FILE, new Date().toISOString(), "utf8");
  } else {
    try {
      fs.unlinkSync(AUTO_CONSULT_FILE);
    } catch {}
  }
}

function runCodex(codexBin, args, promptText) {
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
      reject(new Error(`Codex timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const detail = stderr.trim() || `Codex exited with code ${code}`;
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
  const prompt = isResume ? preamble.followup + text : preamble.initial + text;

  fs.mkdirSync(path.dirname(RESPONSE_FILE), { recursive: true });
  try {
    fs.writeFileSync(RESPONSE_FILE, "", "utf8");
  } catch {}

  const args = [];
  if (isResume) {
    args.push("exec", "resume", existingThread, "-");
  } else {
    args.push("exec", "-");
  }
  args.push("--json", "--sandbox", "read-only", "--output-last-message", RESPONSE_FILE);
  if (effort) {
    args.push("-c", `model_reasoning_effort="${effort}"`);
  }

  let result;
  try {
    result = await runCodex(codexBin, args, prompt);
  } catch (err) {
    if (isResume) {
      clearThreadId();
      const freshArgs = [
        "exec", "-",
        "--json", "--sandbox", "read-only",
        "--output-last-message", RESPONSE_FILE,
        ...(effort ? ["-c", `model_reasoning_effort="${effort}"`] : []),
      ];
      result = await runCodex(codexBin, freshArgs, preamble.initial + text);
    } else {
      throw err;
    }
  }

  if (result.threadId && !isResume) {
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

  return { response, threadId: result.threadId || existingThread, resumed: isResume };
}
