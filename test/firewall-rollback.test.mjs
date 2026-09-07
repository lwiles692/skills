import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = path.resolve("skills/engineering/harden-remote-linux/scripts/rollback-nftables.sh");
const table = { family: "inet", name: "host_public_ingress" };
const snapshot = { nftables: [
  { metainfo: { json_schema_version: 1 } },
  { table: { ...table, handle: 7 } },
  { chain: { family: "inet", table: table.name, name: "input", type: "filter", hook: "input", prio: 0, policy: "accept", handle: 8 } },
  { rule: { family: "inet", table: table.name, chain: "input", expr: [{ accept: null }], handle: 9, index: 0 } }
] };

function fixture(t, { backup = snapshot, exists = true, failCheck = false, failApply = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "firewall-rollback-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  const log = path.join(dir, "calls.jsonl");
  const backupFile = path.join(dir, "table.json");
  fs.writeFileSync(backupFile, typeof backup === "string" ? backup : JSON.stringify(backup));
  fs.writeFileSync(path.join(bin, "nft"), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const input = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.NFT_TEST_LOG, JSON.stringify({args, input}) + '\\n');
if (args.includes('tables')) {
  console.log(JSON.stringify({nftables: ${JSON.stringify(exists ? [{ table }, { table: { family: "ip", name: "docker" } }] : [{ table: { family: "ip", name: "docker" } }])}}));
} else if ((args.includes('--check') && ${failCheck}) || (!args.includes('--check') && ${failApply})) {
  process.stderr.write('simulated nft failure'); process.exit(1);
}
`);
  fs.chmodSync(path.join(bin, "nft"), 0o755);
  return {
    dir,
    run(args = [], tableBackup = backupFile) {
      return spawnSync("sh", [script, "--table-backup", tableBackup, ...args], {
        encoding: "utf8", input: "",
        env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, NFT_TEST_LOG: log }
      });
    },
    calls: () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : []
  };
}

test("restores multiple persistence files without executing their rulesets", (t) => {
  const f = fixture(t);
  const rootBackup = path.join(f.dir, "root.backup");
  const rootTarget = path.join(f.dir, "nftables.conf");
  const includeTarget = path.join(f.dir, "included.conf");
  fs.writeFileSync(rootBackup, 'flush ruleset\ninclude "administrator/*.nft"\n', { mode: 0o640 });
  fs.writeFileSync(rootTarget, "changed root config\n");
  fs.writeFileSync(includeTarget, "new included table\n");
  const result = f.run(["--file", rootBackup, rootTarget, "--file", "__ABSENT__", includeTarget]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(rootTarget, "utf8"), fs.readFileSync(rootBackup, "utf8"));
  assert.equal(fs.statSync(rootTarget).mode & 0o777, 0o640);
  assert.equal(fs.existsSync(includeTarget), false);
  const writes = f.calls().filter((call) => call.args.includes("--file"));
  assert.equal(writes.length, 2); // Syntax check and application use the same JSON transaction.
  assert.equal(writes[0].input, writes[1].input);
  const commands = JSON.parse(writes[1].input).nftables;
  assert.deepEqual(commands[0], { delete: { table } });
  assert.equal(commands.length, 4);
  for (const command of commands.slice(1)) {
    const [kind, obj] = Object.entries(command.add)[0];
    assert.equal(obj.family, "inet");
    assert.equal(kind === "table" ? obj.name : obj.table, table.name);
    assert.equal(obj.handle, undefined);
    assert.equal(obj.index, undefined);
  }
  assert.ok(writes.every((call) => !call.input.includes("flush") && !call.input.includes("docker")));
});

for (const backup of [
  "flush ruleset\n",
  { nftables: [{ flush: { ruleset: null } }] },
  { nftables: [{ table: { family: "ip", name: "docker" } }] },
  { nftables: [snapshot.nftables[1], { chain: { family: "inet", table: table.name, name: "forward", hook: "forward" } }] },
  { nftables: [] }
]) {
  test(`rejects an unsafe or incomplete snapshot before any nft calls: ${JSON.stringify(backup)}`, (t) => {
    const f = fixture(t, { backup });
    assert.notEqual(f.run().status, 0);
    assert.deepEqual(f.calls(), []);
  });
}

test("first-install rollback removes only the owned table", (t) => {
  const f = fixture(t);
  assert.equal(f.run([], "__ABSENT__").status, 0);
  const apply = f.calls().find((call) => call.args.includes("--file") && !call.args.includes("--check"));
  assert.deepEqual(JSON.parse(apply.input), { nftables: [{ delete: { table } }] });
});

test("first-install rollback is harmless when the owned table is already absent", (t) => {
  const f = fixture(t, { exists: false });
  assert.equal(f.run([], "__ABSENT__").status, 0);
  assert.deepEqual(f.calls().map((call) => call.args), [["--json", "list", "tables"]]);
});

test("check mode neither applies nft commands nor restores files", (t) => {
  const f = fixture(t);
  const target = path.join(f.dir, "new-config");
  fs.writeFileSync(target, "keep until rollback");
  assert.equal(f.run(["--check", "--file", "__ABSENT__", target]).status, 0);
  assert.equal(fs.readFileSync(target, "utf8"), "keep until rollback");
  assert.equal(f.calls().some((call) => call.args.includes("--file") && !call.args.includes("--check")), false);
});

for (const failure of ["failCheck", "failApply"]) {
  test(`reports ${failure} without changing persistent configuration`, (t) => {
    const f = fixture(t, { [failure]: true });
    const target = path.join(f.dir, "current-config");
    fs.writeFileSync(target, "unchanged");
    const result = f.run(["--file", "__ABSENT__", target]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /simulated nft failure/);
    assert.equal(fs.readFileSync(target, "utf8"), "unchanged");
  });
}

test("missing persistence backup fails preflight but does not prevent emergency runtime restoration", (t) => {
  const f = fixture(t);
  const missingTarget = path.join(f.dir, "unrestorable-config");
  const removable = path.join(f.dir, "new-include");
  fs.writeFileSync(missingTarget, "current");
  fs.writeFileSync(removable, "new include");
  const args = ["--file", path.join(f.dir, "missing"), missingTarget, "--file", "__ABSENT__", removable];
  const check = f.run(["--check", ...args]);
  assert.notEqual(check.status, 0);
  assert.deepEqual(f.calls(), []);
  const result = f.run(args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Runtime restored, but persistence restore failed/);
  assert.ok(f.calls().some((call) => call.args.includes("--file") && !call.args.includes("--check")));
  assert.equal(fs.readFileSync(missingTarget, "utf8"), "current");
  assert.equal(fs.existsSync(removable), false);
});
