import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  listAgentIds,
  resolveAgentProfile
} from "../skills/engineering/adversarial-code-review/scripts/lib/agents.mjs";
import { parseArgs } from "../skills/engineering/adversarial-code-review/scripts/lib/args.mjs";
import {
  materializeDelegateSkill,
  resolveDelegateSkill
} from "../skills/engineering/adversarial-code-review/scripts/lib/delegate.mjs";
import { buildReviewPrompt } from "../skills/engineering/adversarial-code-review/scripts/lib/prompt.mjs";

const reviewScript = path.resolve(
  "skills/engineering/adversarial-code-review/scripts/review.mjs"
);
const skillFile = path.resolve(
  "skills/engineering/adversarial-code-review/SKILL.md"
);

function run(cwd, command, args, options = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    ...options
  });
}

function git(cwd, args) {
  const result = run(cwd, "git", args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-review-repo-"));
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(repo, "app.js"), "export const value = 1;\n");
  git(repo, ["add", "app.js"]);
  git(repo, ["commit", "-qm", "initial"]);
  return fs.realpathSync(repo);
}

function writeExecutable(directory, name, source) {
  const file = path.join(directory, name);
  fs.writeFileSync(file, `#!/usr/bin/env node\n${source}`);
  fs.chmodSync(file, 0o755);
  return file;
}

function fakeOcr(directory) {
  return writeExecutable(
    directory,
    "fake-ocr.mjs",
    `if (process.argv[2] === "--version") {
  process.stdout.write("open-code-review test\\n");
} else {
  process.stderr.write("wrapper must not call OCR Delegate directly");
  process.exitCode = 9;
}`
  );
}

function createDelegateSkill(directory) {
  const skillDir = path.join(directory, "open-code-review-delegate");
  fs.mkdirSync(skillDir, { recursive: true });
  const file = path.join(skillDir, "SKILL.md");
  fs.writeFileSync(
    file,
    "---\nname: open-code-review-delegate\ndescription: Delegate test skill\n---\n\nUse OCR Delegate.\n"
  );
  return file;
}

function fakeReviewer(directory, { repo, report = null }) {
  return writeExecutable(
    directory,
    "fake-reviewer.mjs",
    `import fs from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("fake-reviewer 1.0\\n");
  process.exit(0);
}
function finish(prompt) {
  if (process.cwd() !== ${JSON.stringify(repo)}) {
    process.stderr.write("reviewer did not run in repository");
    process.exit(9);
  }
  for (const required of ["$open-code-review-delegate", "review-only", "needs-attention"]) {
    if (!prompt.includes(required)) {
      process.stderr.write("missing prompt text: " + required);
      process.exit(9);
    }
  }
  if (prompt.includes("<repository_context>") || prompt.includes("export const value")) {
    process.stderr.write("repository evidence was serialized into prompt");
    process.exit(9);
  }
  const skillPathMatch = prompt.match(/The installed skill is at (.+)\. Read and follow it/);
  const promptSkillFile = skillPathMatch ? JSON.parse(skillPathMatch[1]) : "";
  if (!promptSkillFile.includes("adversarial-review-") || !fs.readFileSync(promptSkillFile, "utf8").includes("name: open-code-review-delegate")) {
    process.stderr.write("prompt did not expose the materialized delegate skill");
    process.exit(9);
  }
  const skillIndex = args.indexOf("--skill");
  if (skillIndex !== -1) {
    const skillFile = args[skillIndex + 1];
    if (!fs.readFileSync(skillFile, "utf8").includes("name: open-code-review-delegate")) {
      process.stderr.write("Pi did not receive the materialized delegate skill");
      process.exit(9);
    }
  }
  const skillsDirIndex = args.indexOf("--skills-dir");
  if (skillsDirIndex !== -1) {
    const skillFile = args[skillsDirIndex + 1] + "/open-code-review-delegate/SKILL.md";
    if (!fs.readFileSync(skillFile, "utf8").includes("name: open-code-review-delegate")) {
      process.stderr.write("Kimi did not receive the materialized delegate skill");
      process.exit(9);
    }
  }
  const outputIndex = args.indexOf("-o");
  const report = ${JSON.stringify(report)};
  if (outputIndex !== -1) fs.writeFileSync(args[outputIndex + 1], report ?? "");
  else process.stdout.write(report ?? "");
}
const promptIndex = args.indexOf("--prompt");
if (promptIndex !== -1) {
  if (Buffer.byteLength(args[promptIndex + 1], "utf8") > 10000) {
    process.stderr.write("Kimi prompt unexpectedly contains a generated packet");
    process.exit(9);
  }
  finish(args[promptIndex + 1]);
} else {
  let prompt = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { prompt += chunk; });
  process.stdin.on("end", () => finish(prompt));
}`
  );
}

test("skill delegates OCR work instead of packetizing repository evidence", () => {
  const instructions = fs.readFileSync(skillFile, "utf8");
  assert.match(instructions, /\$open-code-review-delegate/);
  assert.match(instructions, /Do not prebuild diff packets/);
  assert.match(instructions, /bundled fallback/);
  assert.doesNotMatch(instructions, /max-unit-bytes|context-tokens/);
});

test("requires one external reviewer and parses delegate targets", () => {
  assert.deepEqual(listAgentIds(), ["pi", "claude", "codex", "kimi"]);
  assert.throws(() => parseArgs([]), /--agent is required/);

  const workspace = parseArgs(["--agent", "pi"]);
  assert.equal(workspace.profile.id, "pi");
  assert.equal(workspace.from, null);
  assert.equal(workspace.commit, null);

  const range = parseArgs([
    "--agent",
    "codex",
    "--from",
    "main",
    "--to=HEAD",
    "--focus",
    "rollback"
  ]);
  assert.equal(range.from, "main");
  assert.equal(range.to, "HEAD");
  assert.equal(range.focus, "rollback");

  const commit = parseArgs(["--agent", "kimi", "-c", "abc123"]);
  assert.equal(commit.commit, "abc123");
  assert.equal(resolveAgentProfile("claude-code").id, "claude");
});

test("rejects conflicting targets and removed packet-budget flags", () => {
  assert.throws(
    () => parseArgs(["--agent", "pi", "--from", "main"]),
    /must be provided together/
  );
  assert.throws(
    () =>
      parseArgs([
        "--agent",
        "pi",
        "--commit",
        "abc",
        "--from",
        "main",
        "--to",
        "HEAD"
      ]),
    /cannot be combined/
  );
  assert.throws(
    () => parseArgs(["--agent", "pi", "--context-tokens", "200000"]),
    /Unknown option/
  );
});

test("resolves explicit, installed, and bundled delegate skills", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-skill-"));
  const file = createDelegateSkill(directory);
  const resolvedFile = resolveDelegateSkill(file);
  const resolvedDirectory = resolveDelegateSkill(path.dirname(file));
  assert.equal(resolvedFile.file, file);
  assert.equal(resolvedFile.source, "explicit");
  assert.equal(resolvedDirectory.file, file);

  const invalid = path.join(directory, "invalid.md");
  fs.writeFileSync(invalid, "---\nname: wrong-skill\n---\n");
  assert.throws(() => resolveDelegateSkill(invalid), /does not declare name/);

  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-home-"));
  const bundled = resolveDelegateSkill(null, {
    homeDir,
    bundledFile: file
  });
  assert.equal(bundled.file, file);
  assert.equal(bundled.source, "bundled");

  const realBundled = resolveDelegateSkill(null, { homeDir });
  assert.equal(realBundled.source, "bundled");
  assert.match(realBundled.file, /references\/open-code-review-delegate\.md$/);

  const installedFile = createDelegateSkill(
    path.join(homeDir, ".agents", "skills")
  );
  const installed = resolveDelegateSkill(null, {
    homeDir,
    bundledFile: invalid
  });
  assert.equal(installed.file, installedFile);
  assert.equal(installed.source, "installed");
});

test("materializes the selected delegate skill in a temporary skill root", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-source-"));
  const file = createDelegateSkill(directory);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-materialized-"));
  const materialized = materializeDelegateSkill(resolveDelegateSkill(file), tempDir);
  assert.equal(
    materialized.file,
    path.join(tempDir, "skills", "open-code-review-delegate", "SKILL.md")
  );
  assert.equal(materialized.root, path.join(tempDir, "skills"));
  assert.equal(materialized.materialized, true);
  assert.match(fs.readFileSync(materialized.file, "utf8"), /Use OCR Delegate/);
});

test("review prompt passes delegate options without repository evidence", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-prompt-"));
  const file = createDelegateSkill(directory);
  const options = parseArgs([
    "--agent",
    "pi",
    "--from",
    "main",
    "--to",
    "feature",
    "--exclude",
    "dist/**",
    "--focus",
    "retries"
  ]);
  const prompt = buildReviewPrompt({
    options,
    delegateSkill: resolveDelegateSkill(file),
    ocrBin: "/opt/bin/ocr"
  });
  assert.match(prompt, /open-code-review-delegate/);
  assert.match(prompt, /"mode": "range"/);
  assert.match(prompt, /"from": "main"/);
  assert.match(prompt, /dist\/\*\*/);
  assert.match(prompt, /retries/);
  assert.doesNotMatch(prompt, /repository_context|diff --git/);
});

test("end-to-end wrapper lets every external reviewer drive delegate mode", () => {
  const repo = createRepo();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-review-bin-"));
  const ocr = fakeOcr(binDir);
  const delegateSkill = createDelegateSkill(binDir);
  const expectedReport =
    "Verdict: needs-attention\n\nFull review comments:\n\n- [P2] Preserve rollback — app.js:1-1\n  The change needs a rollback guard.\n";
  const reviewer = fakeReviewer(binDir, { repo, report: expectedReport });

  for (const agent of listAgentIds()) {
    const result = run(repo, process.execPath, [
      reviewScript,
      "--agent",
      agent,
      "--cwd",
      repo,
      "--ocr-bin",
      ocr,
      "--reviewer-bin",
      reviewer,
      "--delegate-skill",
      delegateSkill
    ]);
    assert.equal(result.status, 0, `${agent}: ${result.stderr}`);
    assert.equal(result.stdout, expectedReport);
  }
});

test("checks OCR availability before inspecting the repository", () => {
  const missing = `missing-ocr-${process.pid}-${Date.now()}`;
  const result = run(os.tmpdir(), process.execPath, [
    reviewScript,
    "--agent",
    "pi",
    "--cwd",
    os.tmpdir(),
    "--ocr-bin",
    missing
  ]);
  assert.equal(result.status, 7);
  assert.match(result.stderr, /npm install -g @alibaba-group\/open-code-review/);
  assert.doesNotMatch(result.stderr, /Git repository/);
});

test("fails when the external reviewer returns no report", () => {
  const repo = createRepo();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "delegate-empty-bin-"));
  const ocr = fakeOcr(binDir);
  const delegateSkill = createDelegateSkill(binDir);
  const reviewer = fakeReviewer(binDir, { repo, report: "" });
  const result = run(repo, process.execPath, [
    reviewScript,
    "--agent",
    "pi",
    "--ocr-bin",
    ocr,
    "--reviewer-bin",
    reviewer,
    "--delegate-skill",
    delegateSkill
  ]);
  assert.equal(result.status, 5);
  assert.match(result.stderr, /empty report/);
});
