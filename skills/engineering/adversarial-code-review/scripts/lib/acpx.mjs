import { spawn, spawnSync } from "node:child_process";
import { ReviewError } from "./errors.mjs";

const outerTimeoutGraceMs = 30_000;
const defaultForceKillGraceMs = 2_000;
const defaultMaxStdoutBytes = 4 * 1024 * 1024;
const defaultMaxStderrBytes = 1024 * 1024;

export function getAcpxVersion(acpxBin, cwd) {
  const result = spawnSync(acpxBin, ["--version"], {
    cwd,
    encoding: "utf8",
    shell: false
  });
  if (result.error?.code === "ENOENT") {
    throw new ReviewError(
      `acpx was not found at "${acpxBin}". Install acpx or pass --acpx-bin <path>.`,
      { exitCode: 7, kind: "unavailable" }
    );
  }
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr ?? result.error?.message ?? "").trim();
    throw new ReviewError(`Unable to run acpx --version.${detail ? ` ${detail}` : ""}`, {
      exitCode: 7,
      kind: "unavailable"
    });
  }
  return String(result.stdout).trim() || "unknown";
}

function mapFailure(code, stderr, timedOut) {
  const detail = String(stderr ?? "").trim().slice(0, 4000);
  if (timedOut || code === 3) {
    return new ReviewError(
      `Reviewer timed out.${detail ? `\n${detail}` : ""}`,
      { exitCode: 3, kind: "timeout" }
    );
  }
  if (code === 130) {
    return new ReviewError("Reviewer was interrupted.", {
      exitCode: 1,
      kind: "interrupted"
    });
  }
  if (code === 5) {
    return new ReviewError(
      `Reviewer requested a disallowed permission.${detail ? `\n${detail}` : ""}`,
      { exitCode: 1, kind: "permission-denied" }
    );
  }
  return new ReviewError(
    `acpx reviewer failed with exit code ${code}.${detail ? `\n${detail}` : ""}`,
    { exitCode: 1, kind: "reviewer-error" }
  );
}

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

function processTreeExists(child) {
  if (process.platform === "win32" || !child.pid) return null;
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

export function runAcpxReview({
  acpxBin,
  repoRoot,
  profile,
  prompt,
  timeoutSeconds,
  model,
  reviewerExecutable,
  timeoutGraceMs = outerTimeoutGraceMs,
  forceKillGraceMs = defaultForceKillGraceMs,
  maxStdoutBytes = defaultMaxStdoutBytes,
  maxStderrBytes = defaultMaxStderrBytes
}) {
  const args = [
    "--cwd",
    repoRoot,
    "--approve-reads",
    "--non-interactive-permissions",
    "fail",
    "--no-terminal",
    "--format",
    "quiet",
    "--timeout",
    String(timeoutSeconds)
  ];
  if (model) args.push("--model", model);
  args.push(profile.acpxAgent, "exec", "--file", "-");

  return new Promise((resolve, reject) => {
    const child = spawn(acpxBin, args, {
      cwd: repoRoot,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        ...profile.adapterEnv,
        [profile.executableEnv]: reviewerExecutable
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let settled = false;
    let terminationError = null;
    let forceKillTimer;
    let terminationPollTimer;

    function finalizeTermination(error = terminationError) {
      if (settled) return;
      settled = true;
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (terminationPollTimer) clearTimeout(terminationPollTimer);
      reject(error);
    }

    function waitForProcessTreeExit(attempt = 0) {
      if (processTreeExists(child) === false) {
        finalizeTermination();
        return;
      }
      if (attempt >= 200) {
        finalizeTermination(
          new ReviewError(
            "Unable to confirm that the reviewer process tree terminated after forced kill.",
            { exitCode: 1, kind: "termination-failed" }
          )
        );
        return;
      }
      terminationPollTimer = setTimeout(
        () => waitForProcessTreeExit(attempt + 1),
        25
      );
    }

    function stopTree() {
      terminateProcessTree(child, "SIGTERM");
      forceKillTimer = setTimeout(() => {
        terminateProcessTree(child, "SIGKILL");
        if (process.platform === "win32") finalizeTermination();
        else waitForProcessTreeExit();
      }, forceKillGraceMs);
    }

    function rejectNow(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }

    function terminateThenReject(error) {
      if (settled || terminationError) return;
      terminationError = error;
      clearTimeout(timer);
      stopTree();
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBytes += Buffer.byteLength(chunk, "utf8");
      if (stdoutBytes > maxStdoutBytes) {
        terminateThenReject(
          new ReviewError(
            `Reviewer stdout exceeded ${maxStdoutBytes} bytes.`,
            { exitCode: 1, kind: "output-limit" }
          )
        );
        return;
      }
      if (terminationError) return;
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += Buffer.byteLength(chunk, "utf8");
      if (stderrBytes > maxStderrBytes) {
        terminateThenReject(
          new ReviewError(
            `Reviewer stderr exceeded ${maxStderrBytes} bytes.`,
            { exitCode: 1, kind: "output-limit" }
          )
        );
        return;
      }
      if (terminationError) return;
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        rejectNow(
          new ReviewError(`acpx was not found at "${acpxBin}".`, {
            exitCode: 7,
            kind: "unavailable"
          })
        );
      } else {
        rejectNow(new ReviewError(`Unable to start acpx: ${error.message}`));
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      terminateThenReject(mapFailure(3, stderr, timedOut));
    }, timeoutSeconds * 1000 + timeoutGraceMs);
    timer.unref();

    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (terminationError) {
        if (processTreeExists(child) === false) finalizeTermination();
        return;
      }
      settled = true;
      if (code !== 0) {
        reject(mapFailure(code, stderr, timedOut));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}
