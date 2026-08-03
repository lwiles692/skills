import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ReviewError } from "./errors.mjs";

const profiles = new Map([
  [
    "pi",
    {
      id: "pi",
      executable: "pi",
      displayName: "Pi Coding Agent",
      aliases: ["pi-agent"],
      stdinPrompt: true,
      buildArgs({ model }) {
        const args = [
          "--print",
          "--mode",
          "text",
          "--no-session",
          "--no-tools",
          "--no-context-files",
          "--no-skills",
          "--no-prompt-templates",
          "--no-extensions"
        ];
        if (model) args.push("--model", model);
        return args;
      }
    }
  ],
  [
    "claude",
    {
      id: "claude",
      executable: "claude",
      displayName: "Claude Code",
      aliases: ["claude-code"],
      stdinPrompt: true,
      buildArgs({ model }) {
        const args = [
          "--print",
          "--output-format",
          "text",
          "--permission-mode",
          "plan",
          "--tools",
          "",
          "--no-session-persistence",
          "--disable-slash-commands",
          "--no-chrome"
        ];
        if (model) args.push("--model", model);
        return args;
      }
    }
  ],
  [
    "codex",
    {
      id: "codex",
      executable: "codex",
      displayName: "Codex",
      aliases: [],
      stdinPrompt: true,
      buildArgs({ model, tempDir, outputFile }) {
        const args = [
          "exec",
          "--sandbox",
          "read-only",
          "--ephemeral",
          "--ignore-rules",
          "--skip-git-repo-check",
          "--color",
          "never",
          "-C",
          tempDir,
          "-o",
          outputFile
        ];
        if (model) args.push("--model", model);
        args.push("-");
        return args;
      },
      readReport({ outputFile, stdout }) {
        try {
          const report = fs.readFileSync(outputFile, "utf8");
          if (report.trim()) return report;
        } catch {
          // Fall back to stdout for older Codex CLI versions.
        }
        return stdout;
      }
    }
  ],
  [
    "kimi",
    {
      id: "kimi",
      executable: "kimi",
      displayName: "Kimi Code CLI",
      aliases: ["kimi-code"],
      stdinPrompt: false,
      maxPromptBytes: 128 * 1024,
      buildArgs({ model, prompt, agentFile }) {
        const args = [
          "--prompt",
          prompt,
          "--output-format",
          "text",
          "--agent-file",
          agentFile
        ];
        if (model) args.push("--model", model);
        return args;
      }
    }
  ]
]);

export function listAgentIds() {
  return [...profiles.keys()];
}

export function resolveAgentProfile(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  for (const profile of profiles.values()) {
    if (profile.id === normalized || profile.aliases.includes(normalized)) {
      return profile;
    }
  }
  throw new ReviewError(
    `Unsupported reviewer "${value}". Choose exactly one of: ${listAgentIds().join(", ")}.`,
    { exitCode: 2, kind: "usage-error" }
  );
}

export function resolveReviewerExecutable(
  profile,
  override = null,
  env = process.env
) {
  const requested = override ?? profile.executable;
  if (/[\\/]/.test(requested)) {
    if (!path.isAbsolute(requested)) {
      throw new ReviewError(
        `--reviewer-bin must be a command name on PATH or an absolute path: ${requested}`,
        { exitCode: 2, kind: "usage-error" }
      );
    }
    return path.normalize(requested);
  }

  const locator = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locator, [requested], {
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
      `${profile.displayName} executable "${requested}" was not found on PATH.`,
      { exitCode: 7, kind: "unavailable" }
    );
  }
  return executablePath;
}

export function getReviewerVersion(profile, executable) {
  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 30_000
  });
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr ?? result.error?.message ?? "").trim();
    throw new ReviewError(
      `Unable to run ${profile.displayName} --version.${detail ? ` ${detail}` : ""}`,
      { exitCode: 7, kind: "unavailable" }
    );
  }
  return String(result.stdout ?? "").trim().split(/\r?\n/, 1)[0] || "unknown";
}
