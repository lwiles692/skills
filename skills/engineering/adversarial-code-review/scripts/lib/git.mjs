import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ReviewError } from "./errors.mjs";

const maxGitBuffer = 128 * 1024 * 1024;
const maxInlineUntrackedBytes = 24 * 1024;

function runGit(cwd, args, { allowFailure = false, encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding,
    maxBuffer: maxGitBuffer,
    shell: false
  });
  if (result.error) {
    const missing = result.error.code === "ENOENT";
    throw new ReviewError(
      missing ? "Git is not installed." : `Git failed: ${result.error.message}`,
      { exitCode: missing ? 7 : 1, kind: missing ? "unavailable" : "git-error" }
    );
  }
  if (result.status !== 0 && !allowFailure) {
    const detail = String(result.stderr ?? "").trim();
    throw new ReviewError(
      `Git command failed: git ${args.join(" ")}${detail ? `\n${detail}` : ""}`,
      { exitCode: 1, kind: "git-error" }
    );
  }
  return result;
}

function text(cwd, args, options) {
  return String(runGit(cwd, args, options).stdout ?? "");
}

function splitNull(value) {
  return String(value).split("\0").filter(Boolean);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function ensureRepository(cwd) {
  const result = runGit(cwd, ["rev-parse", "--show-toplevel"], {
    allowFailure: true
  });
  if (result.status !== 0) {
    throw new ReviewError("Run this skill inside a Git repository.", {
      exitCode: 2,
      kind: "usage-error"
    });
  }
  return String(result.stdout).trim();
}

export function getWorkingTreeState(repoRoot) {
  const staged = splitNull(
    text(repoRoot, ["diff", "--cached", "--name-only", "-z"])
  );
  const unstaged = splitNull(text(repoRoot, ["diff", "--name-only", "-z"]));
  const untracked = splitNull(
    text(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"])
  );
  return {
    staged,
    unstaged,
    untracked,
    files: uniqueSorted([...staged, ...unstaged, ...untracked]),
    dirty: staged.length + unstaged.length + untracked.length > 0
  };
}

export function detectDefaultBase(repoRoot) {
  const symbolic = runGit(
    repoRoot,
    ["symbolic-ref", "refs/remotes/origin/HEAD"],
    { allowFailure: true }
  );
  if (symbolic.status === 0) {
    const ref = String(symbolic.stdout).trim();
    if (ref.startsWith("refs/remotes/origin/")) {
      return ref.slice("refs/remotes/origin/".length);
    }
  }

  for (const candidate of ["main", "master", "trunk"]) {
    for (const ref of [candidate, `origin/${candidate}`]) {
      const check = runGit(
        repoRoot,
        ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
        { allowFailure: true }
      );
      if (check.status === 0) return ref;
    }
  }
  throw new ReviewError(
    "Unable to detect a default base branch. Pass --base <ref> or use --scope working-tree.",
    { exitCode: 2, kind: "usage-error" }
  );
}

function resolveBranchTarget(repoRoot, baseRef, explicit) {
  const baseCheck = runGit(
    repoRoot,
    ["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`],
    { allowFailure: true }
  );
  if (baseCheck.status !== 0) {
    throw new ReviewError(`Base ref "${baseRef}" does not resolve to a commit.`, {
      exitCode: 2,
      kind: "usage-error"
    });
  }
  const mergeBase = text(repoRoot, ["merge-base", "HEAD", baseRef]).trim();
  const range = `${mergeBase}..HEAD`;
  const files = splitNull(
    text(repoRoot, ["diff", "--name-only", "-z", range])
  );
  const branch =
    text(repoRoot, ["branch", "--show-current"]).trim() || "HEAD";
  return {
    mode: "branch",
    label: `branch diff against ${baseRef}`,
    baseRef,
    mergeBase,
    range,
    branch,
    files: uniqueSorted(files),
    explicit
  };
}

export function resolveReviewTarget(cwd, { scope = "auto", base = null } = {}) {
  const repoRoot = ensureRepository(cwd);
  const state = getWorkingTreeState(repoRoot);

  if (base) {
    return { repoRoot, target: resolveBranchTarget(repoRoot, base, true), state };
  }
  if (scope === "working-tree") {
    return {
      repoRoot,
      target: {
        mode: "working-tree",
        label: "working tree diff",
        files: state.files,
        explicit: true
      },
      state
    };
  }
  if (scope === "branch") {
    return {
      repoRoot,
      target: resolveBranchTarget(repoRoot, detectDefaultBase(repoRoot), true),
      state
    };
  }
  if (state.dirty) {
    return {
      repoRoot,
      target: {
        mode: "working-tree",
        label: "working tree diff",
        files: state.files,
        explicit: false
      },
      state
    };
  }
  return {
    repoRoot,
    target: resolveBranchTarget(repoRoot, detectDefaultBase(repoRoot), false),
    state
  };
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

function untrackedEntry(repoRoot, relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch {
    return {
      path: relativePath,
      content: `<untracked-file path=${JSON.stringify(relativePath)} unreadable="true" />`,
      warnings: [`Could not read untracked file: ${relativePath}`]
    };
  }
  if (stat.isSymbolicLink()) {
    const destination = fs.readlinkSync(absolute);
    return {
      path: relativePath,
      content: `<untracked-symlink path=${JSON.stringify(relativePath)} target=${JSON.stringify(destination)} />`,
      warnings: [`Reviewed symlink metadata only: ${relativePath}`]
    };
  }
  if (!stat.isFile()) {
    return {
      path: relativePath,
      content: `<untracked-entry path=${JSON.stringify(relativePath)} type="non-file" />`,
      warnings: [`Reviewed metadata only for non-file entry: ${relativePath}`]
    };
  }
  if (stat.size > maxInlineUntrackedBytes) {
    return {
      path: relativePath,
      content: `<untracked-file path=${JSON.stringify(relativePath)} bytes="${stat.size}" inline="false" reason="size-limit" />`,
      warnings: [
        `Untracked file content was not inlined because it exceeds ${maxInlineUntrackedBytes} bytes; the reviewer may inspect it with repository-confined read-only tools: ${relativePath}`
      ]
    };
  }
  const buffer = fs.readFileSync(absolute);
  if (isProbablyBinary(buffer)) {
    return {
      path: relativePath,
      content: `<untracked-binary path=${JSON.stringify(relativePath)} bytes="${buffer.length}" />`,
      warnings: [`Binary content was not sent to the reviewer: ${relativePath}`]
    };
  }
  return {
    path: relativePath,
    content: [
      `<untracked-file path=${JSON.stringify(relativePath)}>`,
      buffer.toString("utf8"),
      "</untracked-file>"
    ].join("\n"),
    warnings: []
  };
}

export function collectReviewEntries(repoRoot, target, state) {
  const untracked = new Set(state.untracked);
  return target.files.map((relativePath) => {
    let content;
    let warnings = [];
    if (target.mode === "working-tree") {
      const staged = text(repoRoot, [
        "diff",
        "--cached",
        "--binary",
        "--no-ext-diff",
        "--submodule=diff",
        "--",
        relativePath
      ]);
      const unstaged = text(repoRoot, [
        "diff",
        "--binary",
        "--no-ext-diff",
        "--submodule=diff",
        "--",
        relativePath
      ]);
      const sections = [];
      if (staged) {
        sections.push(
          `<staged-diff path=${JSON.stringify(relativePath)}>`,
          staged,
          "</staged-diff>"
        );
      }
      if (unstaged) {
        sections.push(
          `<unstaged-diff path=${JSON.stringify(relativePath)}>`,
          unstaged,
          "</unstaged-diff>"
        );
      }
      if (untracked.has(relativePath)) {
        const entry = untrackedEntry(repoRoot, relativePath);
        sections.push(entry.content);
        warnings = entry.warnings;
      }
      content = sections.join("\n");
    } else {
      const diff = text(repoRoot, [
        "diff",
        "--binary",
        "--no-ext-diff",
        "--submodule=diff",
        target.range,
        "--",
        relativePath
      ]);
      content = [
        `<branch-diff path=${JSON.stringify(relativePath)}>`,
        diff || "(none)",
        "</branch-diff>"
      ].join("\n");
    }
    return {
      path: relativePath,
      content,
      bytes: Buffer.byteLength(content, "utf8"),
      warnings
    };
  });
}

export function workspaceFingerprint(repoRoot) {
  const hash = crypto.createHash("sha256");
  hash.update(text(repoRoot, ["status", "--porcelain=v1", "-z"]));
  hash.update(
    text(repoRoot, [
      "diff",
      "--cached",
      "--binary",
      "--no-ext-diff",
      "--submodule=diff"
    ])
  );
  hash.update(
    text(repoRoot, [
      "diff",
      "--binary",
      "--no-ext-diff",
      "--submodule=diff"
    ])
  );

  for (const relativePath of getWorkingTreeState(repoRoot).untracked) {
    hash.update(relativePath);
    const absolute = path.join(repoRoot, relativePath);
    try {
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) hash.update(fs.readlinkSync(absolute));
      else if (stat.isFile()) hash.update(fs.readFileSync(absolute));
      else hash.update(`${stat.mode}:${stat.size}`);
    } catch {
      hash.update("<unreadable>");
    }
  }
  return hash.digest("hex");
}

export function publicTarget(target) {
  if (target.mode === "working-tree") {
    return { mode: target.mode, label: target.label };
  }
  return {
    mode: target.mode,
    label: target.label,
    base_ref: target.baseRef,
    merge_base: target.mergeBase,
    branch: target.branch
  };
}
