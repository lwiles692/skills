import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = path.resolve("skills/engineering/configure-pi-agent-extensions/scripts/configure-pi-agent-extensions.sh");
function fixture(t, settings) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-settings-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, "project with spaces");
  const bin = path.join(dir, "bin");
  fs.mkdirSync(path.join(project, ".pi"), { recursive: true });
  fs.mkdirSync(bin);
  const file = path.join(project, ".pi/settings.json");
  if (settings !== undefined) fs.writeFileSync(file, typeof settings === "string" ? settings : JSON.stringify(settings));
  const log = path.join(dir, "calls.jsonl");
  fs.writeFileSync(path.join(bin, "pi"), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.PI_TEST_LOG, JSON.stringify({args, cwd: process.cwd()}) + '\\n');
if (args[0] === '--version') { console.log('0.79.1'); }
else if (args[0] === 'install' && args[2] === '--local') {
  const file = '.pi/settings.json';
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  settings.packages = [...(settings.packages || []), args[1]];
  fs.writeFileSync(file, JSON.stringify(settings));
} else { throw new Error('Unexpected Pi command: ' + args.join(' ')); }
`);
  fs.chmodSync(path.join(bin, "pi"), 0o755);
  return {
    file, project,
    run(...args) {
      return spawnSync("sh", [script, "--local", "--package", "web-access", ...args], {
        cwd: project, encoding: "utf8",
        env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, PI_TEST_LOG: log }
      });
    },
    calls: () => fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse)
  };
}

test("does not accept a source in an unrelated JSON field as a registration", (t) => {
  const f = fixture(t, { packages: [], note: "npm:pi-web-access" });
  const result = f.run("--verify-only");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing from project-local settings/);
  assert.deepEqual(f.calls().map((call) => call.args), [["--version"]]);
});

for (const entry of ["npm:pi-web-access", { source: "npm:pi-web-access", extensions: [] }]) {
  test(`verifies registration without loading extensions: ${JSON.stringify(entry)}`, (t) => {
    const f = fixture(t, { packages: [entry] });
    const result = f.run("--verify-only");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Extension loading was not tested/);
    assert.deepEqual(f.calls().map((call) => call.args), [["--version"]]);
  });
}

for (const contents of ['{"packages":', '{"packages":{}}', '{"packages":[null]}', '{"packages":null}']) {
  test(`rejects malformed settings before installation: ${contents}`, (t) => {
    const f = fixture(t, contents);
    assert.notEqual(f.run().status, 0);
    assert.equal(fs.readFileSync(f.file, "utf8"), contents);
    assert.deepEqual(f.calls().map((call) => call.args), [["--version"]]);
  });
}

test("installs only the selected package in the target project and preserves unrelated settings", (t) => {
  const original = { packages: ["npm:unrelated"], custom: { source: "npm:pi-web-access" } };
  const f = fixture(t, original);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const saved = JSON.parse(fs.readFileSync(f.file, "utf8"));
  assert.deepEqual(saved, { ...original, packages: ["npm:unrelated", "npm:pi-web-access"] });
  assert.deepEqual(f.calls().map((call) => call.args), [["--version"], ["install", "npm:pi-web-access", "--local"]]);
  assert.ok(f.calls().every((call) => call.cwd === fs.realpathSync(f.project)));
});

test("dry-run resolves an absent settings file in the target project without writing", (t) => {
  const f = fixture(t);
  const result = f.run("--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[missing\]/);
  assert.ok(result.stdout.includes(path.join(fs.realpathSync(f.project), ".pi/settings.json")));
  assert.equal(fs.existsSync(f.file), false);
});
