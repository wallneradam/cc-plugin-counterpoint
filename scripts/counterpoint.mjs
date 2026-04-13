#!/usr/bin/env node

import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SESSION_ID = process.env.CODEX_COMPANION_SESSION_ID || "default";
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || os.tmpdir();
const THREAD_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}.thread`);
const RESPONSE_FILE = path.join(DATA_DIR, `counterpoint-${SESSION_ID}-response.txt`);
const TIMEOUT_MS = 120_000;

const CRITIC_PREAMBLE = `You are a rigorous technical critic in an actor-critic debate. Your job is to find weaknesses, unstated assumptions, missing edge cases, and better alternatives in the proposed plan. Be specific and constructive — identify concrete problems and suggest concrete improvements. Do not rubber-stamp. Challenge the approach even if it seems reasonable.

Structure your response as:
1. STRONGEST OBJECTION: The single biggest risk or flaw
2. ALTERNATIVES: Different approaches worth considering
3. GAPS: Missing considerations
4. VERDICT: weak/moderate/strong with 1-sentence rationale

---

The actor proposes:

`;

const FOLLOWUP_PREAMBLE = `The actor has revised their proposal in response to your critique. Re-evaluate. Focus on whether the revisions adequately address your concerns and whether any new issues were introduced. Use the same structure (STRONGEST OBJECTION / ALTERNATIVES / GAPS / VERDICT).

---

Revised proposal:

`;

function findCodexBin() {
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

function readThreadId() {
  try {
    return fs.readFileSync(THREAD_FILE, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function writeThreadId(threadId) {
  fs.mkdirSync(path.dirname(THREAD_FILE), { recursive: true });
  fs.writeFileSync(THREAD_FILE, threadId, "utf8");
}

function clearThreadId() {
  try {
    fs.unlinkSync(THREAD_FILE);
  } catch {}
  try {
    fs.unlinkSync(RESPONSE_FILE);
  } catch {}
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
      if (code !== 0 && !threadId) {
        reject(new Error(stderr.trim() || `Codex exited with code ${code}`));
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

async function critique(text) {
  const codexBin = findCodexBin();
  if (!codexBin) {
    console.error("Codex CLI not found. Install with: npm install -g @openai/codex");
    process.exitCode = 1;
    return;
  }

  const existingThread = readThreadId();
  const isResume = Boolean(existingThread);
  const prompt = isResume ? FOLLOWUP_PREAMBLE + text : CRITIC_PREAMBLE + text;

  fs.mkdirSync(path.dirname(RESPONSE_FILE), { recursive: true });

  const args = [];
  if (isResume) {
    args.push("exec", "resume", existingThread, "-");
  } else {
    args.push("exec", "-");
  }
  args.push("--json", "--sandbox", "read-only", "--output-last-message", RESPONSE_FILE);

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
      ];
      try {
        result = await runCodex(codexBin, freshArgs, CRITIC_PREAMBLE + text);
      } catch (retryErr) {
        console.error(`Codex error: ${retryErr.message}`);
        process.exitCode = 1;
        return;
      }
    } else {
      console.error(`Codex error: ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }

  if (result.threadId && !isResume) {
    writeThreadId(result.threadId);
  }

  try {
    const response = fs.readFileSync(RESPONSE_FILE, "utf8").trim();
    console.log(response);
  } catch {
    console.error("No response captured from Codex.");
    process.exitCode = 1;
  }
}

function status() {
  const threadId = readThreadId();
  if (threadId) {
    console.log(`Active thread: ${threadId}`);
  } else {
    console.log("No active counterpoint thread.");
  }
}

function reset() {
  clearThreadId();
  console.log("Counterpoint thread cleared.");
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  switch (subcommand) {
    case "critique":
      const text = rest.join(" ").trim();
      if (!text) {
        console.error("Usage: counterpoint.mjs critique <proposal text>");
        process.exitCode = 1;
        return;
      }
      await critique(text);
      break;
    case "status":
      status();
      break;
    case "reset":
      reset();
      break;
    default:
      console.error("Usage: counterpoint.mjs <critique|status|reset> [args]");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
