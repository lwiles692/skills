#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isMapping = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function validateSkills(root = repoRoot) {
  const errors = [];
  let count = 0;
  const fail = (file, message) => errors.push(`${path.relative(root, file)}: ${message}`);

  function readYaml(file, text) {
    try {
      const value = parse(text);
      if (!isMapping(value)) throw new Error("expected a YAML mapping");
      return value;
    } catch (error) {
      fail(file, `invalid YAML: ${error.message}`);
      return null;
    }
  }

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
      const text = fs.readFileSync(absolute, "utf8");
      const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!frontmatter) {
        fail(absolute, "missing YAML frontmatter");
        continue;
      }
      const skill = readYaml(absolute, frontmatter[1]);
      if (!skill) continue;
      if (typeof skill.name !== "string" || !namePattern.test(skill.name)) {
        fail(absolute, "invalid name");
      } else if (skill.name !== path.basename(skillDir)) {
        fail(absolute, "name must match folder");
      }
      if (typeof skill.description !== "string" || !skill.description.trim() || skill.description.includes("TODO")) {
        fail(absolute, "missing description");
      }
      const disabled = skill["disable-model-invocation"];
      if (disabled !== undefined && typeof disabled !== "boolean") {
        fail(absolute, "disable-model-invocation must be a boolean");
      }
      const openaiYaml = path.join(skillDir, "agents", "openai.yaml");
      if (!fs.existsSync(openaiYaml)) {
        fail(skillDir, "missing agents/openai.yaml");
        continue;
      }
      const metadata = readYaml(openaiYaml, fs.readFileSync(openaiYaml, "utf8"));
      if (!metadata) continue;
      if (metadata.policy !== undefined && !isMapping(metadata.policy)) {
        fail(openaiYaml, "policy must be a mapping");
        continue;
      }
      const implicit = metadata.policy?.allow_implicit_invocation;
      if (implicit !== undefined && typeof implicit !== "boolean") {
        fail(openaiYaml, "allow_implicit_invocation must be a boolean");
      } else if ((disabled ?? false) === (implicit ?? true)) {
        fail(openaiYaml, "invocation policy disagrees with SKILL.md");
      }
    }
  }

  for (const relative of ["skills", ".agents/skills"]) {
    const directory = path.join(root, relative);
    if (fs.existsSync(directory)) visit(directory);
  }
  return { count, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { count, errors } = validateSkills();
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${count} skill${count === 1 ? "" : "s"}.`);
  }
}
