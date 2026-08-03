import path from "node:path";
import { resolveAgentProfile } from "./agents.mjs";
import { ReviewError } from "./errors.mjs";

const valueOptions = new Set([
  "agent",
  "from",
  "to",
  "commit",
  "focus",
  "exclude",
  "rule",
  "background",
  "background-file",
  "model",
  "timeout",
  "ocr-timeout",
  "max-unit-bytes",
  "cwd",
  "repo",
  "ocr-bin",
  "reviewer-bin"
]);

const shortOptions = new Map([
  ["-c", "commit"],
  ["-b", "background"],
  ["-B", "background-file"]
]);

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ReviewError(`--${name} must be a positive integer.`, {
      exitCode: 2,
      kind: "usage-error"
    });
  }
  return parsed;
}

export function usage() {
  return `Usage:
  node review.mjs --agent <pi|claude|codex|kimi> [options]

Targets:
  (no target flags)                   Linked worktree: workspace; otherwise: branch
  --from <ref> --to <ref>             Review a branch/ref range
  --commit <hash>                     Review one commit

Options:
  --focus <text>                      Weight a risk area
  --exclude <patterns>                Comma-separated OCR exclusions
  --rule <path>                       Custom OCR rule.json
  -b, --background <text>             Business context for OCR preview
  -B, --background-file <path>        Add business context from Markdown
  --model <id>                        Request a reviewer model
  --timeout <seconds>                 Per-review-unit timeout (default: 900)
  --ocr-timeout <seconds>             Per-OCR-command timeout (default: 120)
  --max-unit-bytes <bytes>             Packet size budget (default: 65536)
  --cwd, --repo <path>                Repository to review (default: cwd)
  --ocr-bin <path>                    ocr executable (default: ocr)
  --reviewer-bin <path>               Override selected reviewer executable
  --help                              Show help
`;
}

export function parseArgs(argv) {
  const raw = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      raw.help = true;
      continue;
    }
    if (shortOptions.has(token)) {
      const name = shortOptions.get(token);
      const value = argv[++index];
      if (value == null || value === "") {
        throw new ReviewError(`${token} requires a value.`, {
          exitCode: 2,
          kind: "usage-error"
        });
      }
      if (raw[name] != null) {
        throw new ReviewError(`--${name} may be provided only once.`, {
          exitCode: 2,
          kind: "usage-error"
        });
      }
      raw[name] = value;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new ReviewError(`Unexpected positional argument: ${token}`, {
        exitCode: 2,
        kind: "usage-error"
      });
    }

    const equalIndex = token.indexOf("=");
    const parsedName = token.slice(2, equalIndex === -1 ? undefined : equalIndex);
    if (!valueOptions.has(parsedName)) {
      throw new ReviewError(`Unknown option: --${parsedName}`, {
        exitCode: 2,
        kind: "usage-error"
      });
    }
    const name = parsedName === "repo" ? "cwd" : parsedName;
    const value =
      equalIndex === -1 ? argv[++index] : token.slice(equalIndex + 1);
    if (value == null || value === "") {
      throw new ReviewError(`--${name} requires a value.`, {
        exitCode: 2,
        kind: "usage-error"
      });
    }
    if (raw[name] != null) {
      throw new ReviewError(`--${name} may be provided only once.`, {
        exitCode: 2,
        kind: "usage-error"
      });
    }
    raw[name] = value;
  }

  if (raw.help) return { help: true };

  if (!raw.agent) {
    throw new ReviewError(
      "--agent is required. Choose exactly one reviewer: pi, claude, codex, or kimi.",
      { exitCode: 2, kind: "usage-error" }
    );
  }

  if ((raw.from && !raw.to) || (raw.to && !raw.from)) {
    throw new ReviewError("--from and --to must be provided together.", {
      exitCode: 2,
      kind: "usage-error"
    });
  }
  if (raw.commit && (raw.from || raw.to)) {
    throw new ReviewError(
      "--commit cannot be combined with --from or --to.",
      { exitCode: 2, kind: "usage-error" }
    );
  }
  return {
    help: false,
    profile: resolveAgentProfile(raw.agent),
    from: raw.from ?? null,
    to: raw.to ?? null,
    commit: raw.commit ?? null,
    focus: raw.focus?.trim() ?? "",
    exclude: raw.exclude ?? null,
    rule: raw.rule ?? null,
    background: raw.background ?? null,
    backgroundFile: raw["background-file"] ?? null,
    timeoutSeconds: positiveInteger(raw.timeout ?? 900, "timeout"),
    ocrTimeoutSeconds: positiveInteger(
      raw["ocr-timeout"] ?? 120,
      "ocr-timeout"
    ),
    maxUnitBytes: positiveInteger(
      raw["max-unit-bytes"] ?? 65_536,
      "max-unit-bytes"
    ),
    cwd: path.resolve(raw.cwd ?? process.cwd()),
    model: raw.model ?? null,
    ocrBin: raw["ocr-bin"] ?? "ocr",
    reviewerBin: raw["reviewer-bin"] ?? null
  };
}
