import path from "node:path";
import { spawnSync } from "node:child_process";
import { ReviewError } from "./errors.mjs";

const maxOutputBytes = 8 * 1024 * 1024;
const ansiEscape = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const sessionWarning = /^\[ocr session\] warning: /;

function stripLeadingOcrDiagnostics(output) {
  const lines = String(output ?? "").replace(ansiEscape, "").split(/\r?\n/);
  while (sessionWarning.test(lines[0] ?? "")) lines.shift();
  return lines.join("\n");
}

export function resolveOcrBin(ocrBin) {
  if (!/[\\/]/.test(ocrBin)) return ocrBin;
  if (path.isAbsolute(ocrBin)) return path.normalize(ocrBin);
  throw new ReviewError(
    `--ocr-bin must be a command name on PATH or an absolute path, not a repository-relative path: ${ocrBin}`,
    { exitCode: 2, kind: "usage-error" }
  );
}

function runOcr(ocrBin, args, { cwd, timeoutSeconds, preflight = false }) {
  const result = spawnSync(ocrBin, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: maxOutputBytes,
    shell: false,
    timeout: timeoutSeconds * 1000
  });
  if (result.error?.code === "ENOENT") {
    throw new ReviewError(
      `ocr is not installed or was not found at "${ocrBin}". Install it with: npm install -g @alibaba-group/open-code-review`,
      { exitCode: 7, kind: "unavailable" }
    );
  }
  if (result.error?.code === "ETIMEDOUT") {
    throw new ReviewError(
      `OCR command timed out after ${timeoutSeconds} seconds: ocr ${args.join(" ")}`,
      { exitCode: 3, kind: "timeout" }
    );
  }
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr ?? result.error?.message ?? "")
      .trim()
      .slice(0, 4000);
    if (preflight) {
      throw new ReviewError(
        `Unable to run ocr --version.${detail ? ` ${detail}` : ""} Install it with: npm install -g @alibaba-group/open-code-review`,
        { exitCode: 7, kind: "unavailable" }
      );
    }
    throw new ReviewError(
      `OCR command failed with exit code ${result.status ?? "unknown"}: ocr ${args.join(" ")}${detail ? `\n${detail}` : ""}`,
      { exitCode: 1, kind: "ocr-error" }
    );
  }
  return stripLeadingOcrDiagnostics(result.stdout);
}

export function getOcrVersion(ocrBin, cwd, timeoutSeconds = 120) {
  const output = runOcr(ocrBin, ["--version"], {
    cwd,
    timeoutSeconds,
    preflight: true
  });
  return output.trim().split(/\r?\n/, 1)[0] || "unknown";
}

function delegateFlags(options, repoRoot, { includeTarget = true } = {}) {
  const args = ["--repo", repoRoot];
  if (includeTarget && options.from) args.push("--from", options.from);
  if (includeTarget && options.to) args.push("--to", options.to);
  if (includeTarget && options.commit) args.push("--commit", options.commit);
  if (options.rule) args.push("--rule", options.rule);
  if (options.exclude) args.push("--exclude", options.exclude);
  if (includeTarget && options.background) {
    args.push("--background", options.background);
  }
  if (includeTarget && options.backgroundFile) {
    args.push("--background-file", options.backgroundFile);
  }
  return args;
}

function oneMetadataValue(metadata, name, { required = false } = {}) {
  const values = metadata.get(name) ?? [];
  if (values.length > 1) {
    throw new ReviewError(
      `OCR delegate preview returned duplicate ${name} metadata.`,
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }
  if (required && values.length !== 1) {
    throw new ReviewError(
      `OCR delegate preview did not return required ${name} metadata.`,
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }
  return values[0] ?? null;
}

function validateReviewPath(repoRoot, relativePath) {
  if (
    !relativePath ||
    relativePath.includes("\0") ||
    path.isAbsolute(relativePath)
  ) {
    throw new ReviewError(
      `OCR delegate preview returned an unsafe review path: ${JSON.stringify(relativePath)}`,
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }
  const resolved = path.resolve(repoRoot, relativePath);
  const prefix = repoRoot.endsWith(path.sep) ? repoRoot : `${repoRoot}${path.sep}`;
  if (resolved === repoRoot || !resolved.startsWith(prefix)) {
    throw new ReviewError(
      `OCR delegate preview returned a path outside the repository: ${JSON.stringify(relativePath)}`,
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }
}

export function parseDelegatePreview(markdown, repoRoot, expected = {}) {
  const normalized = stripLeadingOcrDiagnostics(markdown).trim();
  const lines = normalized.split(/\r?\n/);
  const header = /^# Files \((\d+) reviewable \/ (\d+) total\)$/.exec(
    lines[0] ?? ""
  );
  if (!header) {
    throw new ReviewError(
      "OCR delegate preview returned an unsupported format; expected the '# Files (N reviewable / M total)' header.",
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }

  const metadata = new Map();
  let entriesStart = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (/^(?:  - |~~- )`/.test(lines[index])) {
      entriesStart = index;
      break;
    }
    const match = /^- ([a-z_]+): (.*)$/.exec(lines[index]);
    if (!match) continue;
    const values = metadata.get(match[1]) ?? [];
    values.push(match[2]);
    metadata.set(match[1], values);
  }

  const mode = oneMetadataValue(metadata, "mode", { required: true });
  if (!["workspace", "range", "commit"].includes(mode)) {
    throw new ReviewError(
      `OCR delegate preview returned unsupported mode: ${JSON.stringify(mode)}`,
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }
  const expectedMode = expected.commit
    ? "commit"
    : expected.from && expected.to
      ? "range"
      : "workspace";
  if (mode !== expectedMode) {
    throw new ReviewError(
      `OCR delegate preview returned mode ${mode}, expected ${expectedMode}.`,
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }

  const from = oneMetadataValue(metadata, "from");
  const to = oneMetadataValue(metadata, "to");
  const commit = oneMetadataValue(metadata, "commit");
  const mergeBase = oneMetadataValue(metadata, "merge_base");
  if (mode === "range" && (!mergeBase || !to)) {
    throw new ReviewError(
      "OCR delegate preview range mode requires to and merge_base metadata.",
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }
  if (mode === "commit" && !commit) {
    throw new ReviewError(
      "OCR delegate preview commit mode requires commit metadata.",
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }
  if (expected.from && from !== expected.from) {
    throw new ReviewError("OCR delegate preview changed the requested from ref.", {
      exitCode: 5,
      kind: "invalid-ocr-output"
    });
  }
  if (expected.to && to !== expected.to) {
    throw new ReviewError("OCR delegate preview changed the requested to ref.", {
      exitCode: 5,
      kind: "invalid-ocr-output"
    });
  }
  if (expected.commit && commit !== expected.commit) {
    throw new ReviewError(
      "OCR delegate preview changed the requested commit ref.",
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }

  const files = [];
  const reviewableLine = /^  - `(.+)` \[([^\]]+)\] \+(\d+)\/-(\d+)$/;
  const entryLines = lines.slice(
    entriesStart === -1 ? lines.length : entriesStart
  );
  for (const line of entryLines) {
    const match = reviewableLine.exec(line);
    if (!match) continue;
    validateReviewPath(repoRoot, match[1]);
    files.push({
      path: match[1],
      status: match[2],
      insertions: Number(match[3]),
      deletions: Number(match[4])
    });
  }

  const reviewableCount = Number(header[1]);
  if (files.length !== reviewableCount) {
    throw new ReviewError(
      `OCR delegate preview declared ${reviewableCount} reviewable file(s), but ${files.length} could be parsed safely. The Markdown output may contain an unsupported file name or format.`,
      { exitCode: 5, kind: "invalid-ocr-output" }
    );
  }

  const label =
    mode === "workspace"
      ? "workspace changes"
      : mode === "range"
        ? `${from}..${to} from merge-base ${mergeBase}`
        : `commit ${commit}`;
  return {
    mode,
    label,
    from,
    to,
    commit,
    mergeBase,
    files,
    reviewableCount,
    totalFiles: Number(header[2]),
    markdown: normalized
  };
}

export function runDelegatePreview({ ocrBin, repoRoot, options }) {
  const output = runOcr(
    ocrBin,
    ["delegate", "preview", ...delegateFlags(options, repoRoot)],
    {
      cwd: repoRoot,
      timeoutSeconds: options.ocrTimeoutSeconds
    }
  );
  return parseDelegatePreview(output, repoRoot, options);
}

function ruleBatches(paths) {
  const batches = [];
  let current = [];
  let bytes = 0;
  for (const reviewPath of paths) {
    const pathBytes = Buffer.byteLength(reviewPath, "utf8") + 1;
    if (
      current.length > 0 &&
      (current.length >= 256 || bytes + pathBytes > 96 * 1024)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(reviewPath);
    bytes += pathBytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function runDelegateRules({ ocrBin, repoRoot, options, paths }) {
  const uniquePaths = [...new Set(paths)];
  const batches = ruleBatches(uniquePaths);
  const sections = batches.map((batch, index) => {
    const output = runOcr(
      ocrBin,
      [
        "delegate",
        "rule",
        ...delegateFlags(options, repoRoot, { includeTarget: false }),
        "--",
        ...batch
      ],
      { cwd: repoRoot, timeoutSeconds: options.ocrTimeoutSeconds }
    ).trim();
    if (batches.length === 1) return output;
    return `## OCR rule batch ${index + 1} of ${batches.length}\n\n${output}`;
  });
  return sections.join("\n\n---\n\n");
}
