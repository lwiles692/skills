import { spawnSync } from "node:child_process";
import { ReviewError } from "./errors.mjs";

const profiles = new Map([
  [
    "pi",
    {
      id: "pi",
      acpxAgent: "pi",
      executable: "pi",
      executableEnv: "PI_ACP_PI_COMMAND",
      displayName: "Pi Coding Agent",
      aliases: ["pi-agent"],
      defaultTimeoutSeconds: 900
    }
  ],
  [
    "claude",
    {
      id: "claude",
      acpxAgent: "claude",
      executable: "claude",
      executableEnv: "CLAUDE_CODE_EXECUTABLE",
      adapterEnv: { ACPX_CLAUDE_INCLUDE_USER_SETTINGS: "1" },
      displayName: "Claude Code",
      aliases: ["claude-code"],
      defaultTimeoutSeconds: 900
    }
  ],
  [
    "codex",
    {
      id: "codex",
      acpxAgent: "codex",
      executable: "codex",
      executableEnv: "CODEX_PATH",
      displayName: "Codex",
      aliases: [],
      defaultTimeoutSeconds: 900
    }
  ]
]);

export function listAgentIds() {
  return [...profiles.keys()];
}

export function resolveAgentProfile(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  for (const profile of profiles.values()) {
    if (profile.id === normalized || profile.aliases.includes(normalized)) return profile;
  }
  throw new ReviewError(
    `Unsupported reviewer "${value}". Choose exactly one of: ${listAgentIds().join(", ")}.`,
    { exitCode: 2, kind: "usage-error" }
  );
}

export function resolveReviewerExecutable(profile, cwd, env = process.env) {
  const locator = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locator, [profile.executable], {
    cwd,
    encoding: "utf8",
    env,
    shell: false
  });
  const executablePath = String(result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (result.error || result.status !== 0 || !executablePath) {
    throw new ReviewError(
      `${profile.displayName} executable "${profile.executable}" was not found on PATH.`,
      { exitCode: 7, kind: "unavailable" }
    );
  }
  return executablePath;
}
