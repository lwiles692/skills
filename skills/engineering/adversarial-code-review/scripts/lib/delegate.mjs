import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ReviewError } from "./errors.mjs";

const defaultBundledFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../references/open-code-review-delegate.md"
);

function validateDelegateSkill(requested, sourceKind) {
  const file = fs.existsSync(requested) && fs.statSync(requested).isDirectory()
    ? path.join(requested, "SKILL.md")
    : requested;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new ReviewError(
      `open-code-review-delegate skill was not found at ${file}.`,
      { exitCode: 7, kind: "unavailable" }
    );
  }
  const contents = fs.readFileSync(file, "utf8");
  if (!/^---\n[\s\S]*?^name:\s*open-code-review-delegate\s*$/m.test(contents)) {
    throw new ReviewError(
      `The delegate skill at ${file} does not declare name: open-code-review-delegate.`,
      { exitCode: 2, kind: "usage-error" }
    );
  }
  const directory = path.dirname(file);
  return { file, directory, root: path.dirname(directory), source: sourceKind };
}

export function resolveDelegateSkill(
  override = null,
  { homeDir = os.homedir(), bundledFile = defaultBundledFile } = {}
) {
  if (override) {
    return validateDelegateSkill(path.resolve(override), "explicit");
  }

  const installedFile = path.join(
    homeDir,
    ".agents",
    "skills",
    "open-code-review-delegate",
    "SKILL.md"
  );
  if (fs.existsSync(installedFile)) {
    return validateDelegateSkill(installedFile, "installed");
  }
  return validateDelegateSkill(path.resolve(bundledFile), "bundled");
}

export function materializeDelegateSkill(delegateSkill, tempDir) {
  const root = path.join(tempDir, "skills");
  const directory = path.join(root, "open-code-review-delegate");
  const file = path.join(directory, "SKILL.md");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.copyFileSync(delegateSkill.file, file);
  fs.chmodSync(file, 0o600);
  return { ...delegateSkill, file, directory, root, materialized: true };
}
