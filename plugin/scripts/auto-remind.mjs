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
  `[counterpoint] Reminder: when the user's request involves an important decision, a plan, ` +
  `or a non-trivial problem to think through, use your judgment and invoke the counterpoint skill ` +
  `(MCP tools mcp__counterpoint__critique for concrete proposals, mcp__counterpoint__consult for ` +
  `open questions). This is not auto-consult mode — only engage when a second opinion from Codex ` +
  `would genuinely improve the outcome. Skip for trivial, mechanical, or single-line changes.\n`
);
