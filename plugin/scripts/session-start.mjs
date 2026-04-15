#!/usr/bin/env node
process.stdout.write(
  `[counterpoint] Session ready. Two skills are available and should be used PROACTIVELY:\n` +
  `\n` +
  `  • mcp__counterpoint__consult — for uncertain choices, open design questions, or any ` +
  `non-trivial problem where a second perspective from Codex helps clarify the path forward.\n` +
  `\n` +
  `  • mcp__counterpoint__critique — before finalizing ANY plan, implementation strategy, ` +
  `architectural decision, or multi-step approach. Do not wait for the user to ask.\n` +
  `\n` +
  `Default behavior: consult/critique frequently. Skip only for truly trivial, mechanical, ` +
  `single-line changes.\n` +
  `\n` +
  `When Codex raises concerns or asks clarifying questions in response, resolve them YOURSELF ` +
  `using Read/Grep/Bash/other tools — do NOT relay Codex's questions back to the user. The user ` +
  `sees only the final synthesis after the debate concludes.\n`
);
