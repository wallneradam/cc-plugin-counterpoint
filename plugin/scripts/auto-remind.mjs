#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let input = '';
try {
  input = readFileSync(0, 'utf8');
} catch {}

let sessionId = '';
try {
  sessionId = JSON.parse(input).session_id || '';
} catch {}

const stateDir = join(tmpdir(), 'cc-counterpoint');
if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

const stateFile = join(stateDir, `reminded-${sessionId || process.pid}`);
if (existsSync(stateFile)) process.exit(0);
writeFileSync(stateFile, '');

process.stdout.write(
  `[counterpoint] IMPORTANT: Proactively and frequently invoke the counterpoint skill. ` +
  `Use mcp__counterpoint__consult whenever you face an uncertain choice, an open design question, ` +
  `or a non-trivial problem where a second perspective helps. Use mcp__counterpoint__critique ` +
  `before finalizing ANY plan, implementation strategy, architectural decision, or multi-step ` +
  `approach — do not wait for the user to ask. Default to consulting; skip only for truly trivial, ` +
  `mechanical, single-line changes. When Codex raises concerns or questions in response, resolve ` +
  `them yourself using Read/Grep/Bash/other tools — do NOT relay Codex's questions back to the user. ` +
  `The user sees only the final synthesis.\n`
);
