import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../skills/personal/ffmpeg-traffic-review/scripts/test_traffic_video.sh", import.meta.url));
const ffmpeg = process.env.FFMPEG_BIN || "ffmpeg";
const available = spawnSync(ffmpeg, ["-version"], { encoding: "utf8" });

test("traffic video scripts preserve source times, pixels, and evidence coverage", {
  skip: available.error?.code === "ENOENT" ? "ffmpeg is not installed" : false,
  timeout: 120000,
}, () => {
  assert.equal(available.status, 0, available.stderr || String(available.error || ""));
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: { ...process.env, FFMPEG_BIN: ffmpeg },
    timeout: 110000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, [result.stdout, result.stderr, result.error].filter(Boolean).join("\n"));
});
