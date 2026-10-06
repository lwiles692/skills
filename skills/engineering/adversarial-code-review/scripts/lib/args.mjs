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
  "output",
  "timeout",
  "cwd",
  "repo",
  "ocr-bin",
  "reviewer-bin",
  "delegate-skill"
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
  (no target flags)                   Delegate workspace review
  --from <ref> --to <ref>             Review a branch/ref range
  --commit <hash>                     Review one commit

Options:
  --focus <text>                      Weight a risk area
  --exclude <patterns>                Comma-separated OCR exclusions
  --rule <path>                       Custom rule.json
  -b, --background <text>             Business context for OCR preview
  -B, --background-file <path>        Business context from Markdown
  --model <id>                        Request a reviewer model
  --output <path>                     Save the full report to a new file
  --timeout <seconds>                 Review timeout (default: 900)
  --cwd, --repo <path>                Repository to review (default: cwd)
  --ocr-bin <path>                    OCR executable (default: ocr)
  --reviewer-bin <path>               Override reviewer executable
  --delegate-skill <path>             Override open-code-review-delegate skill
  --help                              Show help
`;
}

export function parseArgs(argv) {
  const raw = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") return { help: true };

    let name;
    let value;
    if (shortOptions.has(token)) {
      name = shortOptions.get(token);
      value = argv[++index];
    } else {
      if (!token.startsWith("--")) {
        throw new ReviewError(`Unexpected positional argument: ${token}`, {
          exitCode: 2,
          kind: "usage-error"
        });
      }
      const equalIndex = token.indexOf("=");
      const parsedName = token.slice(
        2,
        equalIndex === -1 ? undefined : equalIndex
      );
      if (!valueOptions.has(parsedName)) {
        throw new ReviewError(`Unknown option: --${parsedName}`, {
          exitCode: 2,
          kind: "usage-error"
        });
      }
      name = parsedName === "repo" ? "cwd" : parsedName;
      value =
        equalIndex === -1 ? argv[++index] : token.slice(equalIndex + 1);
    }
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
    cwd: path.resolve(raw.cwd ?? process.cwd()),
    model: raw.model ?? null,
    output: raw.output ? path.resolve(raw.output) : null,
    ocrBin: raw["ocr-bin"] ?? "ocr",
    reviewerBin: raw["reviewer-bin"] ?? null,
    delegateSkill: raw["delegate-skill"] ?? null
  };
}
