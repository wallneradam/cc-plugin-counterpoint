import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const GIT_MAX_BUFFER = 16 * 1024 * 1024;

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: GIT_MAX_BUFFER,
    windowsHide: true,
  }).trim();
}

function tryGit(cwd, args) {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
}

export function ensureGitRepository(cwd) {
  const root = tryGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (!root) {
    throw new Error(`Not a git repository: ${cwd}. Review mode needs a git repo to determine what to review.`);
  }
  return root;
}

export function detectDefaultBranch(cwd) {
  const originHead = tryGit(cwd, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  if (originHead) {
    return originHead.replace("refs/remotes/", "");
  }
  for (const candidate of ["main", "master"]) {
    if (tryGit(cwd, ["rev-parse", "--verify", "--quiet", candidate]) !== null) {
      return candidate;
    }
  }
  throw new Error("Unable to detect the repository default branch. Pass base=<ref> or use scope=working-tree.");
}

export function getWorkingTreeState(cwd) {
  const lines = (out) => (out ? out.split("\n").filter(Boolean) : []);
  const staged = lines(git(cwd, ["diff", "--cached", "--name-only"]));
  const unstaged = lines(git(cwd, ["diff", "--name-only"]));
  const untracked = lines(git(cwd, ["ls-files", "--others", "--exclude-standard"]));
  return {
    staged,
    unstaged,
    untracked,
    isDirty: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
  };
}

export function resolveReviewTarget(cwd, { scope = "auto", base = null } = {}) {
  ensureGitRepository(cwd);

  if (base) {
    return { mode: "branch", baseRef: base, label: `branch diff against ${base}` };
  }
  if (scope === "working-tree") {
    return { mode: "working-tree", label: "working tree diff" };
  }
  if (scope === "branch") {
    const detected = detectDefaultBranch(cwd);
    return { mode: "branch", baseRef: detected, label: `branch diff against ${detected}` };
  }
  if (scope !== "auto") {
    throw new Error(`Unsupported review scope "${scope}". Use one of: auto, working-tree, branch.`);
  }

  const state = getWorkingTreeState(cwd);
  if (state.isDirty) {
    return { mode: "working-tree", label: "working tree diff" };
  }
  const detected = detectDefaultBranch(cwd);
  return { mode: "branch", baseRef: detected, label: `branch diff against ${detected}` };
}

function section(title, body) {
  return [`### ${title}`, "", body && body.trim() ? body.trim() : "(none)"].join("\n");
}

/**
 * Composes the full review request text sent to Codex.
 * `followup` selects the reply-round shape (reply first, refreshed scope after).
 * Returns { empty, label, text } — `empty` means there is nothing to review
 * (only meaningful for initial rounds).
 */
export function composeReviewRequest(cwd, { scope, base, paths, focus, reply, followup } = {}) {
  const scopeBlock = buildReviewScopeBlock(cwd, { scope, base, paths });

  if (followup) {
    return {
      ...scopeBlock,
      text: `${reply}\n\n---\n\nRefreshed scope snapshot (the code may have changed since your last look):\n\n${scopeBlock.text}`,
    };
  }

  let text = scopeBlock.text;
  if (focus) {
    text += `\n\n### Focus areas requested by your colleague\n\n${focus}`;
  }
  if (reply) {
    text += `\n\n### Notes from your colleague\n\n${reply}`;
  }
  return { ...scopeBlock, text };
}

/**
 * Path-based scope: review the listed files/directories as they exist on disk,
 * independent of git state (already-committed code, whole modules, non-repo
 * directories). Needs no git at all.
 */
function buildPathsScopeBlock(cwd, paths) {
  const missing = [];
  const lines = [];
  for (const given of paths) {
    const abs = path.isAbsolute(given) ? given : path.join(cwd, given);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      missing.push(given);
      continue;
    }
    lines.push(stat.isDirectory() ? `- ${given}/ (directory — review its source files recursively)` : `- ${given}`);
  }
  if (missing.length > 0) {
    throw new Error(`Review path(s) not found: ${missing.join(", ")}`);
  }

  const label = `path review of ${paths.length} path(s)`;
  const text = [
    "Scope: full review of the following files and directories AS THEY CURRENTLY EXIST ON DISK — independent of git state. This is not a diff review: judge the current code on its own merits.",
    "Read the listed paths directly; use git only if history context helps (e.g. `git log -p <file>` to understand intent).",
    "",
    "### Paths to review",
    "",
    ...lines,
  ].join("\n");
  return { empty: lines.length === 0, label, text };
}

/**
 * Builds a lightweight scope block for the review prompt: what to review and
 * where to look, without inlining full diffs — Codex runs inside the repo with
 * read-only access and inspects the actual changes itself via git.
 * Returns { empty, label, text }.
 */
export function buildReviewScopeBlock(cwd, { scope = "auto", base = null, paths = null } = {}) {
  if (paths && paths.length > 0) {
    return buildPathsScopeBlock(cwd, paths);
  }
  const target = resolveReviewTarget(cwd, { scope, base });

  if (target.mode === "working-tree") {
    const state = getWorkingTreeState(cwd);
    const status = git(cwd, ["status", "--short", "--untracked-files=all"]);
    const stagedStat = git(cwd, ["diff", "--shortstat", "--cached"]);
    const unstagedStat = git(cwd, ["diff", "--shortstat"]);
    const text = [
      `Scope: ${target.label} (staged + unstaged + untracked files).`,
      "Inspect the changes with: `git diff --cached`, `git diff`, and by reading the untracked files listed below.",
      "",
      section("Git Status", status),
      "",
      section("Staged Diff Stat", stagedStat),
      "",
      section("Unstaged Diff Stat", unstagedStat),
      "",
      section("Untracked Files", state.untracked.join("\n")),
    ].join("\n");
    return { empty: !state.isDirty, label: target.label, text };
  }

  const mergeBase = git(cwd, ["merge-base", "HEAD", target.baseRef]);
  const commitRange = `${mergeBase}..HEAD`;
  const currentBranch = tryGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) || "HEAD";
  const log = git(cwd, ["log", "--oneline", "--decorate", commitRange]);
  const diffStat = git(cwd, ["diff", "--stat", commitRange]);
  const text = [
    `Scope: ${target.label} — branch \`${currentBranch}\` from merge-base \`${mergeBase}\`.`,
    `Inspect the changes with: \`git diff ${commitRange}\` (and \`git show\` on individual commits).`,
    "",
    section("Commit Log", log),
    "",
    section("Diff Stat", diffStat),
  ].join("\n");
  return { empty: !log, label: target.label, text };
}
