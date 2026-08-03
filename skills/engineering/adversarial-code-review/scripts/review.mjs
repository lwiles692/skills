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
      "OCR is unavailable. Install it with: npm install -g @alibaba-group/open-code-review"
  });
  getExecutableVersion("OCR", ocrExecutable);
  const reviewerExecutable = resolveReviewerExecutable(
    options.profile,
    options.reviewerBin
  );
  getExecutableVersion(options.profile.displayName, reviewerExecutable);
  const delegateSkill = resolveDelegateSkill(options.delegateSkill);
  const repoRoot = ensureRepository(options.cwd);
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
  process.stdout.write(`${response.report.trimEnd()}\n`);
}

main().catch((cause) => {
  const error = asReviewError(cause);
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode;
});
