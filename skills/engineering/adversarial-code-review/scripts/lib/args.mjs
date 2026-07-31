import path from "node:path";
import { resolveAgentProfile } from "./agents.mjs";
import { ReviewError } from "./errors.mjs";

const valueOptions = new Set([
  "agent",
  "scope",
  "base",
  "focus",
  "timeout",
  "model",
  "max-unit-bytes",
  "cwd",
  "acpx-bin"
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

Options:
  --scope <auto|working-tree|branch>  Review target (default: auto)
  --base <ref>                        Compare HEAD from its merge-base with ref
  --focus <text>                      Weight a risk area
  --model <id>                        Request a reviewer model
  --timeout <seconds>                 Per-unit timeout (default: 900)
  --max-unit-bytes <bytes>            Chunk size (default: 196608)
  --cwd <path>                        Repository to review (default: cwd)
  --acpx-bin <path>                   acpx executable (default: acpx)
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
    if (!token.startsWith("--")) {
      throw new ReviewError(`Unexpected positional argument: ${token}`, {
        exitCode: 2,
        kind: "usage-error"
      });
    }

    const equalIndex = token.indexOf("=");
    const name = token.slice(2, equalIndex === -1 ? undefined : equalIndex);
    if (!valueOptions.has(name)) {
      throw new ReviewError(`Unknown option: --${name}`, {
        exitCode: 2,
        kind: "usage-error"
      });
    }
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

  const scope = raw.scope ?? "auto";
  if (!["auto", "working-tree", "branch"].includes(scope)) {
    throw new ReviewError(
      `Unsupported scope "${scope}". Choose auto, working-tree, or branch.`,
      { exitCode: 2, kind: "usage-error" }
    );
  }
  if (raw.base && scope === "working-tree") {
    throw new ReviewError("--base cannot be combined with --scope working-tree.", {
      exitCode: 2,
      kind: "usage-error"
    });
  }

  return {
    help: false,
    profile: resolveAgentProfile(raw.agent),
    scope,
    base: raw.base ?? null,
    focus: raw.focus?.trim() ?? "",
    timeoutSeconds: positiveInteger(raw.timeout ?? 900, "timeout"),
    maxUnitBytes: positiveInteger(
      raw["max-unit-bytes"] ?? 196_608,
      "max-unit-bytes"
    ),
    cwd: path.resolve(raw.cwd ?? process.cwd()),
    model: raw.model ?? null,
    acpxBin: raw["acpx-bin"] ?? "acpx"
  };
}
