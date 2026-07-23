#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs, usage } from "./lib/args.mjs";
import { resolveReviewerExecutable } from "./lib/agents.mjs";
import { getAcpxVersion, runAcpxReview } from "./lib/acpx.mjs";
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
  extractJson,
  mergeUnitResults,
  validateUnitResult
} from "./lib/result.mjs";
import { renderMarkdown } from "./lib/render.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(
  scriptDir,
  "..",
  "references",
  "unit-review.schema.json"
);

function printDiagnostic(error, asJson = false) {
  if (asJson) {
    process.stderr.write(
      `${JSON.stringify(
        {
          status: "failed",
          error: {
            kind: error.kind,
            message: error.message,
            detail: error.detail
          }
        },
        null,
        2
      )}\n`
    );
  } else {
    process.stderr.write(`${error.message}\n`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const startedAt = Date.now();
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
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
    maxUnitBytes: options.maxUnitBytes,
    maxFilesPerUnit: options.maxFilesPerUnit
  });
  const warnings = collectWarnings(entries, units);
  const acpxVersion = getAcpxVersion(options.acpxBin, repoRoot);
  const reviewerExecutable = resolveReviewerExecutable(
    options.profile,
    repoRoot
  );
  const unitResults = [];

  for (const unit of units) {
    const prompt = buildReviewPrompt({
      target,
      unit,
      totalUnits: units.length,
      manifest: target.files,
      focus: options.focus,
      schema
    });
    const response = await runAcpxReview({
      acpxBin: options.acpxBin,
      repoRoot,
      profile: options.profile,
      prompt,
      timeoutSeconds: options.timeoutSeconds,
      model: options.model,
      reviewerExecutable
    });
    unitResults.push(
      validateUnitResult(extractJson(response.stdout), {
        changedFiles: target.files
      })
    );
  }

  const afterFingerprint = workspaceFingerprint(repoRoot);
  if (afterFingerprint !== beforeFingerprint) {
    throw new ReviewError(
      "The repository changed while the review was running. The report was discarded; rerun against a stable workspace.",
      { exitCode: 6, kind: "workspace-mutated" }
    );
  }

  const aggregate = mergeUnitResults(unitResults);
  const result = {
    schema_version: "1.0",
    status: "completed",
    verdict: aggregate.verdict,
    summary: aggregate.summary,
    findings: aggregate.findings,
    next_steps: aggregate.next_steps,
    metadata: {
      agent: options.profile.id,
      target: publicTarget(target),
      files: target.files.length,
      units: units.length,
      unit_bytes: units.map((unit) => unit.bytes),
      warnings,
      duration_ms: Date.now() - startedAt,
      acpx_version: acpxVersion,
      reviewer_executable: reviewerExecutable
    }
  };

  if (options.format === "json") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(renderMarkdown(result));
  }
}

main().catch((cause) => {
  const error = asReviewError(cause);
  const formatIndex = process.argv.indexOf("--format");
  const wantsJson =
    (formatIndex !== -1 && process.argv[formatIndex + 1] === "json") ||
    process.argv.includes("--format=json");
  printDiagnostic(error, wantsJson);
  process.exitCode = error.exitCode;
});
