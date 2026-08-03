import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { materializeDelegateSkill } from "./delegate.mjs";
import { ReviewError } from "./errors.mjs";

const defaultForceKillGraceMs = 2_000;
const defaultMaxStdoutBytes = 4 * 1024 * 1024;
const defaultMaxStderrBytes = 1024 * 1024;

function terminateProcessTree(child, signal) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const args = ["/PID", String(child.pid), "/T"];
    if (signal === "SIGKILL") args.push("/F");
    spawnSync("taskkill", args, { shell: false, stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // The process tree already exited.
    }
  }
}

export function runExternalReview({
  executable,
  profile,
  buildPrompt,
  model,
  repoRoot,
  delegateSkill,
  timeoutSeconds,
  forceKillGraceMs = defaultForceKillGraceMs,
  maxStdoutBytes = defaultMaxStdoutBytes,
  maxStderrBytes = defaultMaxStderrBytes
}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "adversarial-review-"));
  const outputFile = path.join(tempDir, "last-message.md");
  let effectiveDelegateSkill;
  let effectivePrompt;
  let args;
  try {
    effectiveDelegateSkill = materializeDelegateSkill(delegateSkill, tempDir);
    effectivePrompt = buildPrompt(effectiveDelegateSkill);
    args = profile.buildArgs({
      model,
      prompt: effectivePrompt,
      repoRoot,
      outputFile,
      delegateSkill: effectiveDelegateSkill
    });
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
  const childEnv = { ...process.env };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES"
  ]) {
    delete childEnv[name];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: repoRoot,
      detached: process.platform !== "win32",
      env: childEnv,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminationError = null;
    let forceKillTimer;

    function cleanup() {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Temporary output cleanup failure does not change the review result.
      }
    }

    function finishReject(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      cleanup();
      reject(error);
    }

    function terminateThenReject(error) {
      if (settled || terminationError) return;
      terminationError = error;
      clearTimeout(timer);
      terminateProcessTree(child, "SIGTERM");
      forceKillTimer = setTimeout(() => {
        terminateProcessTree(child, "SIGKILL");
        finishReject(error);
      }, forceKillGraceMs);
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBytes += Buffer.byteLength(chunk, "utf8");
      if (stdoutBytes > maxStdoutBytes) {
        terminateThenReject(
          new ReviewError(
            `${profile.displayName} stdout exceeded ${maxStdoutBytes} bytes.`,
            { exitCode: 1, kind: "output-limit" }
          )
        );
        return;
      }
      if (!terminationError) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += Buffer.byteLength(chunk, "utf8");
      if (stderrBytes > maxStderrBytes) {
        terminateThenReject(
          new ReviewError(
            `${profile.displayName} stderr exceeded ${maxStderrBytes} bytes.`,
            { exitCode: 1, kind: "output-limit" }
          )
        );
        return;
      }
      if (!terminationError) stderr += chunk;
    });
    child.on("error", (error) => {
      finishReject(
        new ReviewError(
          `Unable to start ${profile.displayName}: ${error.message}`,
          { exitCode: error.code === "ENOENT" ? 7 : 1, kind: "reviewer-error" }
        )
      );
    });

    const timer = setTimeout(() => {
      terminateThenReject(
        new ReviewError(
          `${profile.displayName} timed out after ${timeoutSeconds} seconds.`,
          { exitCode: 3, kind: "timeout" }
        )
      );
    }, timeoutSeconds * 1000);
    timer.unref();

    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (terminationError) {
        terminateProcessTree(child, "SIGKILL");
        finishReject(terminationError);
        return;
      }
      if (code !== 0) {
        const detail = stderr.trim().slice(0, 4000);
        finishReject(
          new ReviewError(
            `${profile.displayName} failed with exit code ${code}.${detail ? `\n${detail}` : ""}`,
            { exitCode: 1, kind: "reviewer-error" }
          )
        );
        return;
      }
      const report = profile.readReport
        ? profile.readReport({ outputFile, stdout })
        : stdout;
      if (!report.trim()) {
        finishReject(
          new ReviewError(`${profile.displayName} returned an empty report.`, {
            exitCode: 5,
            kind: "empty-output"
          })
        );
        return;
      }
      settled = true;
      cleanup();
      resolve({ report, stdout, stderr });
    });

    child.stdin.on("error", () => {});
    child.stdin.end(profile.stdinPrompt ? effectivePrompt : "");
  });
}
