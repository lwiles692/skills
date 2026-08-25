#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoots = [
  path.join(repoRoot, "skills"),
  path.join(repoRoot, ".agents", "skills")
];
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const errors = [];
let count = 0;

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolute);
      continue;
    }
    if (entry.name !== "SKILL.md") continue;

    count += 1;
    const skillDir = path.dirname(absolute);
    const folderName = path.basename(skillDir);
    const text = fs.readFileSync(absolute, "utf8");
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);

    if (!frontmatter) {
      errors.push(`${path.relative(repoRoot, absolute)}: missing YAML frontmatter`);
      continue;
    }

    const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();

    if (!name || !namePattern.test(name)) {
      errors.push(`${path.relative(repoRoot, absolute)}: invalid name`);
    } else if (name !== folderName) {
      errors.push(`${path.relative(repoRoot, absolute)}: name must match folder`);
    }
    if (!description || description.includes("TODO")) {
      errors.push(`${path.relative(repoRoot, absolute)}: missing description`);
    }

    const openaiYaml = path.join(skillDir, "agents", "openai.yaml");
    if (!fs.existsSync(openaiYaml)) {
      errors.push(`${path.relative(repoRoot, skillDir)}: missing agents/openai.yaml`);
    }
  }
}

for (const skillsRoot of skillsRoots) {
  if (fs.existsSync(skillsRoot)) visit(skillsRoot);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`Validated ${count} skill${count === 1 ? "" : "s"}.`);
}
