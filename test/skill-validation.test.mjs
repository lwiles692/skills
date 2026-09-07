import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateSkills } from "../scripts/validate-skills.mjs";

function fixture(t, flag, policy) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-policy-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, "skills/engineering/example");
  fs.mkdirSync(path.join(folder, "agents"), { recursive: true });
  fs.writeFileSync(path.join(folder, "SKILL.md"), `---\nname: example\ndescription: >\n  A multiline description.\n${flag}\n---\nBody.\n`);
  fs.writeFileSync(path.join(folder, "agents/openai.yaml"), `interface:\n  display_name: Example\n${policy}\n`);
  return root;
}

for (const [label, flag, policy] of [
  ["implicit defaults", "", ""],
  ["explicit-only", "disable-model-invocation: true", "policy:\n  allow_implicit_invocation: false"],
  ["inline YAML policy", "disable-model-invocation: true", "policy: { allow_implicit_invocation: false }"],
  ["explicit automatic", "disable-model-invocation: false", "policy:\n  allow_implicit_invocation: true"]
]) {
  test(`accepts consistent ${label}`, (t) => {
    assert.deepEqual(validateSkills(fixture(t, flag, policy)), { count: 1, errors: [] });
  });
}

for (const [label, flag, policy, expected] of [
  ["missing Codex opt-out", "disable-model-invocation: true", "", /disagrees/],
  ["missing frontmatter opt-out", "", "policy: { allow_implicit_invocation: false }", /disagrees/],
  ["quoted boolean", 'disable-model-invocation: "true"', "", /must be a boolean/],
  ["quoted Codex boolean", "", 'policy: { allow_implicit_invocation: "false" }', /must be a boolean/],
  ["nested unrelated flag", "disable-model-invocation: true", "dependencies:\n  allow_implicit_invocation: false", /disagrees/],
  ["invalid YAML", "", "policy: [", /invalid YAML/],
  ["duplicate policy", "", "policy: {}\npolicy: {}", /invalid YAML/]
]) {
  test(`rejects ${label}`, (t) => {
    assert.match(validateSkills(fixture(t, flag, policy)).errors.join("\n"), expected);
  });
}
