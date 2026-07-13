#!/usr/bin/env node

import {
  runSession,
  readThreadId,
  clearThreadId,
  hasReviewed,
  isAutoConsult,
  setAutoConsult,
  VALID_EFFORTS,
} from "../lib/codex-session.mjs";
import { composeReviewRequest } from "../lib/git-scope.mjs";

function status() {
  const threadId = readThreadId();
  if (threadId) {
    console.log(`Active thread: ${threadId}`);
  } else {
    console.log("No active counterpoint thread.");
  }
  console.log(`Auto-consult: ${isAutoConsult() ? "ON" : "off"}`);
}

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  switch (subcommand) {
    case "critique":
    case "consult": {
      let effort = null;
      const filtered = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--effort") {
          if (i + 1 < rest.length) {
            effort = rest[++i];
          } else {
            console.error(`--effort requires a value: ${[...VALID_EFFORTS].join(", ")}`);
            process.exitCode = 1;
            return;
          }
        } else {
          filtered.push(rest[i]);
        }
      }
      const text = filtered.join(" ").trim();
      if (!text) {
        console.error(`Usage: counterpoint.mjs ${subcommand} [--effort <level>] <text>`);
        process.exitCode = 1;
        return;
      }
      try {
        const { response } = await runSession(subcommand, text, effort);
        console.log(response);
      } catch (err) {
        console.error(`Codex error: ${err.message}`);
        process.exitCode = 1;
      }
      break;
    }
    case "review": {
      let effort = null;
      let scope = "auto";
      let base = null;
      let reply = null;
      const paths = [];
      const filtered = [];
      for (let i = 0; i < rest.length; i++) {
        const flag = rest[i];
        if (flag === "--effort" || flag === "--scope" || flag === "--base" || flag === "--reply" || flag === "--path") {
          if (i + 1 >= rest.length) {
            console.error(`${flag} requires a value`);
            process.exitCode = 1;
            return;
          }
          const value = rest[++i];
          if (flag === "--effort") effort = value;
          else if (flag === "--scope") scope = value;
          else if (flag === "--base") base = value;
          else if (flag === "--path") paths.push(value);
          else reply = value;
        } else {
          filtered.push(flag);
        }
      }
      const focus = filtered.join(" ").trim() || null;

      try {
        const followup = Boolean(reply) && hasReviewed();
        const request = composeReviewRequest(process.cwd(), { scope, base, paths, focus, reply, followup });

        if (!followup && request.empty) {
          console.log(`Nothing to review: ${request.label} is empty.`);
          return;
        }

        const { response } = await runSession("review", request.text, effort);
        console.log(response);
      } catch (err) {
        console.error(`Codex error: ${err.message}`);
        process.exitCode = 1;
      }
      break;
    }
    case "status":
      status();
      break;
    case "reset":
      clearThreadId();
      console.log("Counterpoint thread cleared.");
      break;
    case "consult-on":
      setAutoConsult(true);
      console.log("Auto-consult mode: ON");
      break;
    case "consult-off":
      setAutoConsult(false);
      console.log("Auto-consult mode: off");
      break;
    default:
      console.error("Usage: counterpoint.mjs <critique|consult|review|status|reset|consult-on|consult-off> [args]");
      console.error("  review [--scope auto|working-tree|branch] [--base <ref>] [--path <file-or-dir>]... [--effort <level>] [--reply <text>] [focus...]");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
