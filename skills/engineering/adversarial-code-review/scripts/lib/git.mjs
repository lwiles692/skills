import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ReviewError } from "./errors.mjs";

const maxGitBuffer = 128 * 1024 * 1024;

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

function canonicalGitPath(repoRoot, value) {
  const absolute = path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
  try {
    return fs.realpathSync.native(absolute);
  } catch {
    return path.normalize(absolute);
  }
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

export function isLinkedWorktree(repoRoot) {
  const gitDir = text(repoRoot, ["rev-parse", "--absolute-git-dir"]).trim();
  const commonDir = text(repoRoot, ["rev-parse", "--git-common-dir"]).trim();
  return (
    canonicalGitPath(repoRoot, gitDir) !==
    canonicalGitPath(repoRoot, commonDir)
  );
}

function resolvesToCommit(repoRoot, ref) {
  return (
    runGit(
      repoRoot,
      ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
      { allowFailure: true }
    ).status === 0
  );
}

export function detectDefaultBase(repoRoot) {
  const symbolic = runGit(
    repoRoot,
    ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
    { allowFailure: true }
  );
  if (symbolic.status === 0) {
    const remoteDefault = String(symbolic.stdout).trim();
    if (remoteDefault && resolvesToCommit(repoRoot, remoteDefault)) {
      return remoteDefault;
    }
  }

  for (const candidate of [
    "main",
    "master",
    "trunk",
    "origin/main",
    "origin/master",
    "origin/trunk"
  ]) {
    if (resolvesToCommit(repoRoot, candidate)) return candidate;
  }
  throw new ReviewError(
    "Unable to detect a default base branch. Pass --from <ref> --to <ref> or --commit <hash>.",
    { exitCode: 2, kind: "usage-error" }
  );
}

export function resolveDefaultTarget(repoRoot, options) {
  if (options.from || options.to || options.commit) return options;
  if (isLinkedWorktree(repoRoot)) return options;
  return {
    ...options,
    from: detectDefaultBase(repoRoot),
    to: "HEAD"
  };
}

function getWorkingTreeState(repoRoot) {
  return {
    untracked: new Set(
      splitNull(text(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]))
    )
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
  const buffer = fs.readFileSync(absolute);
  if (isProbablyBinary(buffer)) {
    return {
      path: relativePath,
      content: `<untracked-binary path=${JSON.stringify(relativePath)} bytes="${buffer.length}" />`,
      warnings: [`Binary content was not included: ${relativePath}`]
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

function workspaceEntry(repoRoot, file, state) {
  if (state.untracked.has(file.path)) return untrackedEntry(repoRoot, file.path);
  const diff = text(repoRoot, [
    "diff",
    "--binary",
    "--no-ext-diff",
    "--submodule=diff",
    "HEAD",
    "--",
    file.path
  ]);
  return {
    path: file.path,
    content: [
      `<workspace-diff path=${JSON.stringify(file.path)}>`,
      diff || "(none)",
      "</workspace-diff>"
    ].join("\n"),
    warnings: diff ? [] : [`OCR selected a tracked file with an empty HEAD diff: ${file.path}`]
  };
}

function rangeEntry(repoRoot, target, file) {
  const diff = text(repoRoot, [
    "diff",
    "--binary",
    "--no-ext-diff",
    "--submodule=diff",
    `${target.mergeBase}..${target.to}`,
    "--",
    file.path
  ]);
  return {
    path: file.path,
    content: [
      `<range-diff path=${JSON.stringify(file.path)}>`,
      diff || "(none)",
      "</range-diff>"
    ].join("\n"),
    warnings: diff ? [] : [`OCR selected a file with an empty range diff: ${file.path}`]
  };
}

function commitEntry(repoRoot, target, file) {
  const diff = text(repoRoot, [
    "show",
    "--format=",
    "--binary",
    "--no-ext-diff",
    "--submodule=diff",
    target.commit,
    "--",
    file.path
  ]);
  return {
    path: file.path,
    content: [
      `<commit-diff path=${JSON.stringify(file.path)}>`,
      diff || "(none)",
      "</commit-diff>"
    ].join("\n"),
    warnings: diff ? [] : [`OCR selected a file with an empty commit diff: ${file.path}`]
  };
}

export function collectReviewEntries(repoRoot, target) {
  const state = target.mode === "workspace" ? getWorkingTreeState(repoRoot) : null;
  return target.files.map((file) => {
    const entry =
      target.mode === "workspace"
        ? workspaceEntry(repoRoot, file, state)
        : target.mode === "range"
          ? rangeEntry(repoRoot, target, file)
          : commitEntry(repoRoot, target, file);
    return {
      ...entry,
      status: file.status,
      bytes: Buffer.byteLength(entry.content, "utf8")
    };
  });
}

export function publicTarget(target) {
  return {
    mode: target.mode,
    label: target.label,
    from: target.from,
    to: target.to,
    commit: target.commit,
    merge_base: target.mergeBase
  };
}
