#!/usr/bin/env node

import {
  runSession,
  readThreadId,
  clearThreadId,
  isAutoConsult,
  setAutoConsult,
  VALID_EFFORTS,
} from "../lib/codex-session.mjs";

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
      console.error("Usage: counterpoint.mjs <critique|consult|status|reset|consult-on|consult-off> [args]");
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
