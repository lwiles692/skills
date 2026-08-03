#!/usr/bin/env node

import process from "node:process";
import {
  getReviewerVersion,
  resolveReviewerExecutable
} from "./lib/agents.mjs";
import { parseArgs, usage } from "./lib/args.mjs";
import { collectWarnings, planReviewUnits } from "./lib/context.mjs";
import { asReviewError, ReviewError } from "./lib/errors.mjs";
import {
  collectReviewEntries,
  ensureRepository,
  publicTarget,
  resolveDefaultTarget
} from "./lib/git.mjs";
import {
  getOcrVersion,
  resolveOcrBin,
  runDelegatePreview,
  runDelegateRules
} from "./lib/ocr.mjs";
import { buildReviewPacket } from "./lib/prompt.mjs";
import {
  normalizeUnitReport,
  overallVerdict,
  unresolvedVerdict
} from "./lib/report.mjs";
import { runExternalReview } from "./lib/reviewer.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const ocrBin = resolveOcrBin(options.ocrBin);
  const ocrVersion = getOcrVersion(
    ocrBin,
    process.cwd(),
    options.ocrTimeoutSeconds
  );
  const reviewerExecutable = resolveReviewerExecutable(
    options.profile,
    options.reviewerBin
  );
  const reviewerVersion = getReviewerVersion(
    options.profile,
    reviewerExecutable
  );

  const startedAt = Date.now();
  const repoRoot = ensureRepository(options.cwd);
  const targetOptions = resolveDefaultTarget(repoRoot, options);
  const target = runDelegatePreview({
    ocrBin,
    repoRoot,
    options: targetOptions
  });
  if (target.files.length === 0) {
    throw new ReviewError(`No reviewable changes in ${target.label}.`, {
      exitCode: 4,
      kind: "no-changes"
    });
  }

  const entries = collectReviewEntries(repoRoot, target);
  const units = planReviewUnits(entries, {
    maxUnitBytes: options.maxUnitBytes
  });
  const warnings = collectWarnings(entries, units);
  const unitReports = [];

  for (const unit of units) {
    const rulesMarkdown = runDelegateRules({
      ocrBin,
      repoRoot,
      options: targetOptions,
      paths: unit.entries.map((entry) => entry.path)
    });
    const prompt = buildReviewPacket({
      target,
      unit,
      totalUnits: units.length,
      manifest: target.files,
      focus: options.focus,
      previewMarkdown: target.markdown,
      rulesMarkdown
    });
    const response = await runExternalReview({
      executable: reviewerExecutable,
      profile: options.profile,
      prompt,
      model: options.model,
      timeoutSeconds: options.timeoutSeconds
    });
    if (!response.report.trim()) {
      throw new ReviewError(
        `Review unit ${unit.index + 1}: ${options.profile.displayName} returned an empty report.`,
        { exitCode: 5, kind: "empty-output" }
      );
    }
    const normalized = normalizeUnitReport(response.report);
    if (!normalized.verdict) {
      warnings.push(
        `Review unit ${unit.index + 1}: the external reviewer did not open with an exact Verdict line, so this unit cannot approve the run.`
      );
    }
    unitReports.push({
      index: unit.index,
      verdict: normalized.verdict,
      report: normalized.report
    });
  }

  const verdict = overallVerdict(unitReports.map((unit) => unit.verdict));
  const lines = [
    "# Adversarial Code Review",
    "",
    `Reviewer: ${options.profile.id} (${reviewerVersion})`,
    `Engine: ${ocrVersion} delegate`,
    `Target: ${publicTarget(target).label}`,
    `Overall verdict: ${verdict}`,
    ""
  ];
  if (verdict === unresolvedVerdict) {
    lines.push(
      "At least one independent review unit had no readable verdict. Read every unit before treating this run as approved.",
      ""
    );
  }
  for (const unit of unitReports) {
    if (unitReports.length > 1) {
      lines.push(
        `## Review unit ${unit.index + 1} of ${unitReports.length} — ${unit.verdict ?? "no readable verdict"}`,
        ""
      );
    }
    lines.push(
      unit.report || "The reviewer returned a verdict with no commentary.",
      ""
    );
  }
  if (warnings.length > 0) {
    lines.push("## Coverage warnings", "");
    for (const warning of [...new Set(warnings)]) lines.push(`- ${warning}`);
    lines.push("");
  }
  lines.push(
    `Reviewed ${target.files.length} file(s) in ${units.length} independent unit(s) with ${options.profile.displayName}; OCR supplied scope and rules. Duration: ${Date.now() - startedAt}ms.`,
    ""
  );
  process.stdout.write(lines.join("\n"));
}

main().catch((cause) => {
  const error = asReviewError(cause);
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode;
});
