#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import {
  getExecutableVersion,
  resolveExecutable,
  resolveReviewerExecutable
} from "./lib/agents.mjs";
import { parseArgs, usage } from "./lib/args.mjs";
import { resolveDelegateSkill } from "./lib/delegate.mjs";
import { asReviewError, ReviewError } from "./lib/errors.mjs";
import { buildReviewPrompt } from "./lib/prompt.mjs";
import { runExternalReview } from "./lib/reviewer.mjs";

function ensureRepository(cwd) {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
    shell: false
  });
  if (result.error || result.status !== 0) {
    throw new ReviewError("Run this skill inside a Git repository.", {
      exitCode: 2,
      kind: "usage-error"
    });
  }
  const repoRoot = String(result.stdout).trim();
  if (!repoRoot || !fs.existsSync(repoRoot)) {
    throw new ReviewError("Git did not return a usable repository root.", {
      exitCode: 2,
      kind: "usage-error"
    });
  }
  return path.resolve(repoRoot);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const ocrExecutable = resolveExecutable(options.ocrBin, {
    displayName: "OCR",
    unavailableMessage:
      "OCR is required but was not found on PATH.\n\n" +
      "Why it is needed: OCR deterministically selects the files to review and resolves repository rules before the external agent analyzes the changes. Without OCR, the review cannot establish its scope.\n\n" +
      "Installation changes the global npm environment and may require network access. After showing the user this reason, the skill may install OCR automatically without waiting for conversational confirmation by running:\n" +
      "npm install -g @alibaba-group/open-code-review\n\n" +
      "If OCR is already installed elsewhere, pass its path with --ocr-bin <path>."
  });
  getExecutableVersion("OCR", ocrExecutable);
  const reviewerExecutable = resolveReviewerExecutable(
    options.profile,
    options.reviewerBin
  );
  getExecutableVersion(options.profile.displayName, reviewerExecutable);
  const delegateSkill = resolveDelegateSkill(options.delegateSkill);
  const repoRoot = ensureRepository(options.cwd);
  let outputFd = null;
  if (options.output) {
    try {
      outputFd = fs.openSync(options.output, "wx", 0o600);
    } catch (cause) {
      throw new ReviewError(`Unable to create report file ${JSON.stringify(options.output)}: ${cause.message}`, {
        kind: "output-error"
      });
    }
  }
  let reportSaved = false;
  let report;
  try {
    process.stderr.write(`[adversarial-code-review] running (${options.profile.id}); wait for this process to exit.\n`);
    const response = await runExternalReview({
      executable: reviewerExecutable,
      profile: options.profile,
      buildPrompt: (effectiveDelegateSkill) =>
        buildReviewPrompt({
          options,
          delegateSkill: effectiveDelegateSkill,
          ocrBin: ocrExecutable
        }),
      model: options.model,
      repoRoot,
      delegateSkill,
      timeoutSeconds: options.timeoutSeconds
    });
    report = `${response.report.trimEnd()}\n`;
    if (outputFd !== null) {
      fs.writeFileSync(outputFd, report, "utf8");
      reportSaved = true;
    }
  } finally {
    if (outputFd !== null) {
      fs.closeSync(outputFd);
      if (!reportSaved) fs.rmSync(options.output, { force: true });
    }
  }
  process.stdout.write(report);
  const location = options.output ? JSON.stringify(options.output) : "stdout";
  process.stderr.write(`[adversarial-code-review] completed; report: ${location}. Caller: read the full report and assess the findings before finishing.\n`);
}

main().catch((cause) => {
  const error = asReviewError(cause);
  process.stderr.write(`[adversarial-code-review] failed; review did not complete.\n${error.message}\n`);
  process.exitCode = error.exitCode;
});
