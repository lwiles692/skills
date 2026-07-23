import path from "node:path";
import { ReviewError } from "./errors.mjs";

const severities = new Set(["critical", "high", "medium", "low"]);
const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
const findingKeys = new Set([
  "severity",
  "confidence",
  "category",
  "title",
  "body",
  "file",
  "line_start",
  "line_end",
  "failure_scenario",
  "recommendation"
]);

function fail(message) {
  throw new ReviewError(`Invalid reviewer output: ${message}`, {
    exitCode: 5,
    kind: "invalid-output"
  });
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value.trim();
}

function exactKeys(value, expected, label) {
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) fail(`${label} has unexpected property "${key}"`);
  }
  for (const key of expected) {
    if (!(key in value)) fail(`${label} is missing property "${key}"`);
  }
}

export function extractJson(text) {
  let normalized = String(text ?? "").trim();
  const fence = normalized.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) normalized = fence[1].trim();
  try {
    return JSON.parse(normalized);
  } catch (directError) {
    let inString = false;
    let escaped = false;
    let depth = 0;
    let start = -1;

    for (let index = 0; index < normalized.length; index += 1) {
      const character = normalized[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        if (depth === 0) start = index;
        depth += 1;
      } else if (character === "}" && depth > 0) {
        depth -= 1;
        if (depth !== 0 || start === -1) continue;
        try {
          const candidate = JSON.parse(normalized.slice(start, index + 1));
          if (
            candidate &&
            typeof candidate === "object" &&
            ["verdict", "summary", "findings", "next_steps"].every(
              (key) => key in candidate
            )
          ) {
            return candidate;
          }
        } catch {
          // Continue looking for a contract-shaped JSON object.
        }
        start = -1;
      }
    }

    fail(`response is not valid JSON (${directError.message})`);
  }
}

export function validateUnitResult(value, { changedFiles }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("root must be an object");
  }
  exactKeys(
    value,
    new Set(["verdict", "summary", "findings", "next_steps"]),
    "root"
  );
  if (!["approve", "needs-attention"].includes(value.verdict)) {
    fail("verdict must be approve or needs-attention");
  }
  const summary = nonEmptyString(value.summary, "summary");
  if (!Array.isArray(value.findings)) fail("findings must be an array");
  if (!Array.isArray(value.next_steps)) fail("next_steps must be an array");

  const allowedFiles = new Set(changedFiles.map((file) => path.normalize(file)));
  const findings = value.findings.map((finding, index) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
      fail(`findings[${index}] must be an object`);
    }
    exactKeys(finding, findingKeys, `findings[${index}]`);
    if (!severities.has(finding.severity)) {
      fail(`findings[${index}].severity is invalid`);
    }
    if (
      typeof finding.confidence !== "number" ||
      finding.confidence < 0 ||
      finding.confidence > 1
    ) {
      fail(`findings[${index}].confidence must be between 0 and 1`);
    }
    if (
      !Number.isInteger(finding.line_start) ||
      finding.line_start < 1 ||
      !Number.isInteger(finding.line_end) ||
      finding.line_end < finding.line_start
    ) {
      fail(`findings[${index}] has an invalid line range`);
    }
    const file = path.normalize(
      nonEmptyString(finding.file, `findings[${index}].file`).replace(/^\.\//, "")
    );
    if (!allowedFiles.has(file)) {
      fail(`findings[${index}].file is not a changed file: ${file}`);
    }
    return {
      severity: finding.severity,
      confidence: finding.confidence,
      category: nonEmptyString(finding.category, `findings[${index}].category`),
      title: nonEmptyString(finding.title, `findings[${index}].title`),
      body: nonEmptyString(finding.body, `findings[${index}].body`),
      file,
      line_start: finding.line_start,
      line_end: finding.line_end,
      failure_scenario: nonEmptyString(
        finding.failure_scenario,
        `findings[${index}].failure_scenario`
      ),
      recommendation: nonEmptyString(
        finding.recommendation,
        `findings[${index}].recommendation`
      )
    };
  });

  if (findings.length === 0 && value.verdict !== "approve") {
    fail("verdict must be approve when findings is empty");
  }
  if (findings.length > 0 && value.verdict !== "needs-attention") {
    fail("verdict must be needs-attention when findings exist");
  }

  return {
    verdict: value.verdict,
    summary,
    findings,
    next_steps: value.next_steps.map((step, index) =>
      nonEmptyString(step, `next_steps[${index}]`)
    )
  };
}

function findingKey(finding) {
  const title = finding.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${finding.file}:${finding.line_start}:${finding.line_end}:${title}`;
}

export function mergeUnitResults(results) {
  const deduplicated = new Map();
  for (const result of results) {
    for (const finding of result.findings) {
      const key = findingKey(finding);
      const current = deduplicated.get(key);
      if (!current) {
        deduplicated.set(key, finding);
        continue;
      }
      const preferred =
        finding.confidence >= current.confidence ? finding : current;
      deduplicated.set(key, {
        ...preferred,
        severity:
          severityRank[finding.severity] > severityRank[current.severity]
            ? finding.severity
            : current.severity,
        confidence: Math.max(finding.confidence, current.confidence)
      });
    }
  }

  const findings = [...deduplicated.values()].sort((left, right) => {
    return (
      severityRank[right.severity] - severityRank[left.severity] ||
      right.confidence - left.confidence ||
      left.file.localeCompare(right.file) ||
      left.line_start - right.line_start
    );
  });
  const nextSteps = [
    ...new Set(results.flatMap((result) => result.next_steps))
  ];
  const highest = findings[0]?.severity ?? null;
  return {
    verdict: findings.length > 0 ? "needs-attention" : "approve",
    summary:
      findings.length > 0
        ? `${findings.length} material finding${findings.length === 1 ? "" : "s"}; highest severity: ${highest}.`
        : "No material adversarial findings were supported by the reviewed evidence.",
    findings,
    next_steps: nextSteps
  };
}
