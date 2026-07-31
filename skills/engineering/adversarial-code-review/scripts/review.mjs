#!/usr/bin/env node

import process from "node:process";
import { parseArgs, usage } from "./lib/args.mjs";
import { resolveReviewerExecutable } from "./lib/agents.mjs";
import {
  getAcpxVersion,
  resolveAcpxBin,
  runAcpxReview
} from "./lib/acpx.mjs";
import { collectWarnings, planReviewUnits } from "./lib/context.mjs";
import { asReviewError, ReviewError } from "./lib/errors.mjs";
import {
  collectReviewEntries,
  publicTarget,
  resolveReviewTarget,
  workspaceFingerprint
} from "./lib/git.mjs";
import { buildReviewPrompt } from "./lib/prompt.mjs";
import {
  normalizeUnitReport,
  overallVerdict,
  unresolvedVerdict
} from "./lib/report.mjs";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const acpxBin = resolveAcpxBin(options.acpxBin, options.cwd);
  const acpxVersion = getAcpxVersion(acpxBin, process.cwd());
  const startedAt = Date.now();
  const { repoRoot, target, state } = resolveReviewTarget(options.cwd, {
    scope: options.scope,
    base: options.base
  });

  if (target.files.length === 0) {
    throw new ReviewError(`No reviewable changes in ${target.label}.`, {
      exitCode: 4,
      kind: "no-changes"
    });
  }

  const beforeFingerprint = workspaceFingerprint(repoRoot);
  const entries = collectReviewEntries(repoRoot, target, state);
  const units = planReviewUnits(entries, {
    maxUnitBytes: options.maxUnitBytes
  });
  const warnings = collectWarnings(entries, units);
  const reviewerExecutable = resolveReviewerExecutable(
    options.profile,
    repoRoot
  );
  const unitReports = [];

  for (const unit of units) {
    const prompt = buildReviewPrompt({
      target,
      unit,
      totalUnits: units.length,
      manifest: target.files,
      focus: options.focus
    });
    const response = await runAcpxReview({
      acpxBin,
      repoRoot,
      profile: options.profile,
      prompt,
      timeoutSeconds: options.timeoutSeconds,
      model: options.model,
      reviewerExecutable
    });
    if (!response.report.trim()) {
      throw new ReviewError(
        `Review unit ${unit.index + 1}: the reviewer returned an empty report.`,
        { exitCode: 5, kind: "empty-output" }
      );
    }
    const { verdict, report } = normalizeUnitReport(response.report);
    // Anything that can truncate or taint a unit costs it its vote, so a
    // degraded run reports as unresolved instead of approving.
    let trusted = verdict;
    if (response.mutatingTools.length > 0) {
      trusted = null;
      warnings.push(
        `Review unit ${unit.index + 1}: the reviewer ran ${response.mutatingTools.join(", ")}, which the review-only instruction forbids. Treat its report as untrusted and check the workspace.`
      );
    } else if (response.permissionDenied) {
      trusted = null;
      warnings.push(
        `Review unit ${unit.index + 1}: the reviewer requested a disallowed permission and the request was denied, so its report may be incomplete. It cannot approve the run.`
      );
    } else if (!verdict) {
      warnings.push(
        `Review unit ${unit.index + 1}: the report does not open with "Verdict: approve" or "Verdict: needs-attention", so it cannot count toward the overall verdict. Read that unit in full.`
      );
    }
    unitReports.push({ index: unit.index, verdict: trusted, report });
  }

  const afterFingerprint = workspaceFingerprint(repoRoot);
  if (afterFingerprint !== beforeFingerprint) {
    throw new ReviewError(
      "The repository changed while the review was running. The report was discarded; rerun against a stable workspace.",
      { exitCode: 6, kind: "workspace-mutated" }
    );
  }

  const verdict = overallVerdict(unitReports.map((unit) => unit.verdict));
  const lines = [
    "# Adversarial Code Review",
    "",
    `Reviewer: ${options.profile.id}`,
    `Target: ${publicTarget(target).label}`,
    `Overall verdict: ${verdict}`,
    ""
  ];
  if (verdict === unresolvedVerdict) {
    lines.push(
      "At least one unit reported no readable verdict and no unit reported needs-attention. Read every unit before treating this run as approved.",
      ""
    );
  }
  for (const { index, verdict: unitVerdict, report } of unitReports) {
    if (unitReports.length > 1) {
      lines.push(
        `## Review unit ${index + 1} of ${unitReports.length} — ${unitVerdict ?? "no readable verdict"}`,
        ""
      );
    }
    lines.push(report || "The reviewer returned a verdict with no commentary.", "");
  }
  if (warnings.length > 0) {
    lines.push("## Coverage warnings", "");
    for (const warning of warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  lines.push(
    `Reviewed ${target.files.length} file(s) in ${units.length} unit(s) via acpx ${acpxVersion} in ${Date.now() - startedAt}ms.`,
    ""
  );

  process.stdout.write(lines.join("\n"));
}

main().catch((cause) => {
  const error = asReviewError(cause);
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode;
});
