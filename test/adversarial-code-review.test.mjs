import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseArgs } from "../skills/engineering/adversarial-code-review/scripts/lib/args.mjs";
import { resolveReviewerExecutable } from "../skills/engineering/adversarial-code-review/scripts/lib/agents.mjs";
import { runAcpxReview } from "../skills/engineering/adversarial-code-review/scripts/lib/acpx.mjs";
import { planReviewUnits } from "../skills/engineering/adversarial-code-review/scripts/lib/context.mjs";
import {
  collectReviewEntries,
  getWorkingTreeState,
  resolveReviewTarget,
  workspaceFingerprint
} from "../skills/engineering/adversarial-code-review/scripts/lib/git.mjs";
import {
  extractJson,
  mergeUnitResults,
  validateUnitResult
} from "../skills/engineering/adversarial-code-review/scripts/lib/result.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewScript = path.join(
  repoRoot,
  "skills",
  "engineering",
  "adversarial-code-review",
  "scripts",
  "review.mjs"
);

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function fixtureRepository() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "adversarial-review-"));
  git(cwd, "init", "-b", "main");
  git(cwd, "config", "user.email", "test@example.com");
  git(cwd, "config", "user.name", "Test");
  fs.writeFileSync(path.join(cwd, "base.js"), "export const base = true;\n");
  git(cwd, "add", "base.js");
  git(cwd, "commit", "-m", "base");
  return cwd;
}

function makeExecutable(directory, name, source = "#!/bin/sh\nexit 0\n") {
  const executable = path.join(directory, name);
  fs.writeFileSync(executable, source);
  fs.chmodSync(executable, 0o755);
  return executable;
}

test("requires one explicit reviewer", () => {
  assert.throws(() => parseArgs([]), /--agent is required/);
  assert.equal(parseArgs(["--agent", "claude"]).profile.id, "claude");
  assert.throws(
    () => parseArgs(["--agent", "gemini"]),
    /Unsupported reviewer/
  );
});

test("resolves every reviewer executable from PATH", () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "reviewer-bin-"));
  const env = { ...process.env, PATH: `${binDir}:/usr/bin:/bin` };

  for (const id of ["pi", "claude", "codex"]) {
    const executable = makeExecutable(binDir, id);
    const profile = parseArgs(["--agent", id]).profile;
    assert.equal(resolveReviewerExecutable(profile, process.cwd(), env), executable);
  }
});

test("passes every resolved reviewer path through its adapter environment", async () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "reviewer-env-"));
  for (const id of ["pi", "claude", "codex"]) {
    const profile = parseArgs(["--agent", id]).profile;
    const reviewerExecutable = makeExecutable(binDir, id);
    const fakeAcpx = makeExecutable(
      binDir,
      `fake-acpx-${id}.mjs`,
      `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  executable: process.env[${JSON.stringify(profile.executableEnv)}] ?? "",
  includeUserSettings: process.env.ACPX_CLAUDE_INCLUDE_USER_SETTINGS ?? ""
}));
`
    );
    const response = await runAcpxReview({
      acpxBin: fakeAcpx,
      repoRoot: process.cwd(),
      profile,
      prompt: "review",
      timeoutSeconds: 1,
      reviewerExecutable
    });
    assert.deepEqual(JSON.parse(response.stdout), {
      executable: reviewerExecutable,
      includeUserSettings: id === "claude" ? "1" : ""
    });
  }
});

test("auto scope selects a dirty working tree", () => {
  const cwd = fixtureRepository();
  fs.writeFileSync(path.join(cwd, "new.js"), "export const value = 1;\n");
  const { target } = resolveReviewTarget(cwd, { scope: "auto" });
  assert.equal(target.mode, "working-tree");
  assert.deepEqual(target.files, ["new.js"]);
});

test("collects a staged deletion and same-path untracked replacement", () => {
  const cwd = fixtureRepository();
  git(cwd, "rm", "--cached", "base.js");
  fs.writeFileSync(path.join(cwd, "base.js"), "export const replacement = true;\n");
  const state = getWorkingTreeState(cwd);
  const { target } = resolveReviewTarget(cwd, { scope: "working-tree" });
  const [entry] = collectReviewEntries(cwd, target, state);

  assert.match(entry.content, /<staged-diff/);
  assert.match(entry.content, /deleted file mode/);
  assert.match(entry.content, /<untracked-file/);
  assert.match(entry.content, /replacement = true/);
});

test("branch scope uses the merge-base", () => {
  const cwd = fixtureRepository();
  git(cwd, "switch", "-c", "feature");
  fs.writeFileSync(path.join(cwd, "base.js"), "export const base = false;\n");
  git(cwd, "add", "base.js");
  git(cwd, "commit", "-m", "feature");
  const { target } = resolveReviewTarget(cwd, {
    scope: "branch",
    base: "main"
  });
  assert.equal(target.mode, "branch");
  assert.equal(target.baseRef, "main");
  assert.deepEqual(target.files, ["base.js"]);
  assert.match(target.range, /\.\.HEAD$/);
});

test("chunk planner splits oversized entries without truncation", () => {
  const entries = [
    { path: "a.js", bytes: 20, content: "a".repeat(20) },
    { path: "b.js", bytes: 3000, content: "b".repeat(3000) },
    { path: "c.js", bytes: 20, content: "c".repeat(20) }
  ];
  const units = planReviewUnits(entries, {
    maxUnitBytes: 1024,
    maxFilesPerUnit: 2
  });
  const parts = units
    .flatMap((unit) => unit.entries)
    .filter((entry) => entry.path === "b.js");
  assert.ok(parts.length > 1);
  assert.equal(parts.map((entry) => entry.payload).join(""), entries[1].content);
  assert.ok(parts.every((entry) => entry.segment.total === parts.length));
  assert.ok(units.every((unit) => unit.bytes <= 1024));
});

test("validates and merges reviewer results", () => {
  const first = validateUnitResult(
    {
      verdict: "needs-attention",
      summary: "risk",
      findings: [
        {
          severity: "high",
          confidence: 0.8,
          category: "idempotency",
          title: "Duplicate write",
          body: "Retries can insert twice.",
          file: "src/write.js",
          line_start: 10,
          line_end: 12,
          failure_scenario: "The response is lost after commit.",
          recommendation: "Add an idempotency key."
        }
      ],
      next_steps: ["Add a retry test"]
    },
    { changedFiles: ["src/write.js"] }
  );
  const second = validateUnitResult(
    {
      verdict: "needs-attention",
      summary: "same risk",
      findings: [
        {
          severity: "critical",
          confidence: 0.9,
          category: "idempotency",
          title: "Duplicate write",
          body: "A replay duplicates durable state.",
          file: "./src/write.js",
          line_start: 10,
          line_end: 12,
          failure_scenario: "A client retries after a timeout.",
          recommendation: "Enforce uniqueness in storage."
        }
      ],
      next_steps: ["Add a retry test"]
    },
    { changedFiles: ["src/write.js"] }
  );
  const merged = mergeUnitResults([first, second]);
  assert.equal(merged.findings.length, 1);
  assert.equal(merged.findings[0].severity, "critical");
  assert.equal(merged.findings[0].confidence, 0.9);
  assert.deepEqual(merged.next_steps, ["Add a retry test"]);
});

test("extracts a review object after adapter startup text", () => {
  const review = {
    verdict: "approve",
    summary: "No material issue.",
    findings: [],
    next_steps: []
  };
  assert.deepEqual(
    extractJson(`pi v0.81.1\ncontext: repository\n${JSON.stringify(review)}\n`),
    review
  );
});

test("rejects oversized reviewer output", async () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "output-limit-"));
  const fakeAcpx = makeExecutable(
    binDir,
    "fake-acpx.mjs",
    `#!/usr/bin/env node
process.stdout.write("x".repeat(256));
`
  );

  await assert.rejects(
    runAcpxReview({
      acpxBin: fakeAcpx,
      repoRoot: process.cwd(),
      profile: parseArgs(["--agent", "codex"]).profile,
      prompt: "review",
      timeoutSeconds: 1,
      timeoutGraceMs: 10,
      reviewerExecutable: "/usr/bin/false",
      maxStdoutBytes: 32,
      maxStderrBytes: 32
    }),
    (error) => error.kind === "output-limit"
  );
});

test("timeout terminates the reviewer process tree", async () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "process-tree-"));
  const graceMarker = path.join(binDir, "descendant-ran-during-grace");
  const lateMarker = path.join(binDir, "descendant-survived-force-kill");
  const descendant = makeExecutable(
    binDir,
    "descendant.mjs",
    `#!/usr/bin/env node
import fs from "node:fs";
process.on("SIGTERM", () => {});
setTimeout(() => fs.writeFileSync(${JSON.stringify(graceMarker)}, "grace"), 25);
setTimeout(() => fs.writeFileSync(${JSON.stringify(lateMarker)}, "survived"), 1500);
setInterval(() => {}, 1000);
`
  );
  const fakeAcpx = makeExecutable(
    binDir,
    "fake-acpx.mjs",
    `#!/usr/bin/env node
import { spawn } from "node:child_process";
process.on("SIGTERM", () => {});
spawn(${JSON.stringify(descendant)}, [], { stdio: "inherit" });
setInterval(() => {}, 1000);
`
  );

  const startedAt = Date.now();
  await assert.rejects(
    runAcpxReview({
      acpxBin: fakeAcpx,
      repoRoot: process.cwd(),
      profile: parseArgs(["--agent", "codex"]).profile,
      prompt: "review",
      timeoutSeconds: 1,
      timeoutGraceMs: 10,
      forceKillGraceMs: 100,
      reviewerExecutable: "/usr/bin/false"
    }),
    (error) => error.kind === "timeout"
  );
  assert.ok(Date.now() - startedAt >= 1050);
  assert.equal(fs.existsSync(graceMarker), true);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(fs.existsSync(lateMarker), false);
});

test("end-to-end CLI preserves the workspace and emits validated JSON", () => {
  const cwd = fixtureRepository();
  fs.writeFileSync(path.join(cwd, "new.js"), "export const value = 1;\n");
  const before = workspaceFingerprint(cwd);
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-acpx-"));
  const fakeAcpx = path.join(fakeBinDir, "fake-acpx.mjs");
  const fakePi = makeExecutable(fakeBinDir, "pi");
  fs.writeFileSync(
    fakeAcpx,
    `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.stdout.write("acpx test\\n");
} else {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const permissionModeIndex = process.argv.indexOf("--non-interactive-permissions");
    if (
      !process.argv.includes("--approve-reads") ||
      process.argv.includes("--deny-all") ||
      !process.argv.includes("--no-terminal") ||
      permissionModeIndex === -1 ||
      process.argv[permissionModeIndex + 1] !== "fail"
    ) {
      process.stderr.write("unsafe permission flags");
      process.exitCode = 1;
      return;
    }
    if (process.env.PI_ACP_PI_COMMAND !== ${JSON.stringify(fakePi)}) {
      process.stderr.write("missing resolved pi path");
      process.exitCode = 1;
      return;
    }
    if (!input.includes("<untrusted_context>") || !input.includes("new.js")) {
      process.stderr.write("missing review contract");
      process.exitCode = 1;
      return;
    }
    process.stdout.write(JSON.stringify({
      verdict: "approve",
      summary: "No material issue.",
      findings: [],
      next_steps: []
    }));
  });
}
`
  );
  fs.chmodSync(fakeAcpx, 0o755);

  const result = spawnSync(
    process.execPath,
    [
      reviewScript,
      "--agent",
      "pi",
      "--cwd",
      cwd,
      "--scope",
      "working-tree",
      "--format",
      "json",
      "--acpx-bin",
      fakeAcpx
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeBinDir}:${process.env.PATH}` }
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "completed");
  assert.equal(output.verdict, "approve");
  assert.equal(output.metadata.agent, "pi");
  assert.equal(output.metadata.reviewer_executable, fakePi);
  assert.equal(output.metadata.files, 1);
  assert.equal(workspaceFingerprint(cwd), before);
});

test("end-to-end CLI invokes the reviewer once per large-diff unit", () => {
  const cwd = fixtureRepository();
  fs.writeFileSync(path.join(cwd, "first.js"), "export const first = 1;\n");
  fs.writeFileSync(path.join(cwd, "second.js"), "export const second = 2;\n");
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-acpx-"));
  const fakeAcpx = path.join(fakeBinDir, "fake-acpx.mjs");
  const fakeCodex = makeExecutable(fakeBinDir, "codex");
  const counterPath = path.join(fakeBinDir, "calls.txt");
  fs.writeFileSync(
    fakeAcpx,
    `#!/usr/bin/env node
import fs from "node:fs";
const counterPath = ${JSON.stringify(counterPath)};
if (process.argv.includes("--version")) {
  process.stdout.write("acpx test\\n");
} else {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => input += chunk);
  process.stdin.on("end", () => {
    const prior = fs.existsSync(counterPath)
      ? Number(fs.readFileSync(counterPath, "utf8"))
      : 0;
    fs.writeFileSync(counterPath, String(prior + 1));
    if (process.env.CODEX_PATH !== ${JSON.stringify(fakeCodex)}) {
      process.stderr.write("missing resolved codex path");
      process.exitCode = 1;
      return;
    }
    if (!input.includes("Review unit")) {
      process.stderr.write("missing unit metadata");
      process.exitCode = 1;
      return;
    }
    process.stdout.write(JSON.stringify({
      verdict: "approve",
      summary: "Unit reviewed.",
      findings: [],
      next_steps: []
    }));
  });
}
`
  );
  fs.chmodSync(fakeAcpx, 0o755);

  const result = spawnSync(
    process.execPath,
    [
      reviewScript,
      "--agent=codex",
      "--cwd",
      cwd,
      "--scope",
      "working-tree",
      "--format=json",
      "--max-files-per-unit",
      "1",
      "--acpx-bin",
      fakeAcpx
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeBinDir}:${process.env.PATH}` }
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.metadata.agent, "codex");
  assert.equal(output.metadata.reviewer_executable, fakeCodex);
  assert.equal(output.metadata.files, 2);
  assert.equal(output.metadata.units, 2);
  assert.equal(fs.readFileSync(counterPath, "utf8"), "2");
});
