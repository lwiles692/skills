#!/usr/bin/env node

import fs from "node:fs";

try {
  const file = process.argv[2];
  if (!file) throw new Error("Expected a settings file path.");
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (text !== undefined) {
    const settings = JSON.parse(text);
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      throw new Error("Settings must be a JSON object.");
    }
    const packages = Object.hasOwn(settings, "packages") ? settings.packages : [];
    if (!Array.isArray(packages)) throw new Error("packages must be an array.");
    const sources = packages.map((entry) => {
      const source = typeof entry === "string" ? entry : entry?.source;
      if (typeof source !== "string" || !source || /[\r\n]/.test(source)) {
        throw new Error("Each package must be a source string or an object with a source string.");
      }
      return source;
    });
    for (const source of sources) process.stdout.write(`${source}\n`);
  }
} catch (error) {
  process.stderr.write(`Cannot read package registrations: ${error.message}\n`);
  process.exitCode = 1;
}
