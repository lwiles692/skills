function splitTextByBytes(text, maxBytes) {
  const parts = [];
  let current = "";
  let currentBytes = 0;

  function flush() {
    if (!current) return;
    parts.push(current);
    current = "";
    currentBytes = 0;
  }

  for (const character of text) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (current && currentBytes + characterBytes > maxBytes) flush();
    current += character;
    currentBytes += characterBytes;
    if (currentBytes >= maxBytes) flush();
  }
  flush();
  return parts;
}

function segmentEntry(entry, maxUnitBytes) {
  if (entry.bytes <= maxUnitBytes) return [entry];

  // Reserve room for the part envelope while retaining every source byte.
  const payloadLimit = Math.max(1, maxUnitBytes - 512);
  const payloads = splitTextByBytes(entry.content, payloadLimit);
  return payloads.map((payload, index) => {
    const content = [
      `<partial-entry path=${JSON.stringify(entry.path)} part="${index + 1}" of="${payloads.length}">`,
      payload,
      "</partial-entry>"
    ].join("\n");
    return {
      ...entry,
      content,
      bytes: Buffer.byteLength(content, "utf8"),
      payload,
      segment: { part: index + 1, total: payloads.length },
      warnings:
        index === 0
          ? [
              ...(entry.warnings ?? []),
              `Split oversized review entry into ${payloads.length} parts without truncation: ${entry.path}`
            ]
          : []
    };
  });
}

export function planReviewUnits(entries, { maxUnitBytes = 196_608 } = {}) {
  const units = [];
  let current = [];
  let currentBytes = 0;

  function flush() {
    if (current.length === 0) return;
    units.push({
      index: units.length,
      entries: current,
      bytes: currentBytes,
      oversized: current.some((entry) => entry.bytes > maxUnitBytes)
    });
    current = [];
    currentBytes = 0;
  }

  const segmentedEntries = entries.flatMap((entry) =>
    segmentEntry(entry, maxUnitBytes)
  );

  // Size is the only reason to split. A file count budget would cut a small
  // change into several model calls for no context-window reason and cost the
  // reviewer its cross-file view of the change.
  for (const entry of segmentedEntries) {
    if (current.length > 0 && currentBytes + entry.bytes > maxUnitBytes) flush();

    current.push(entry);
    currentBytes += entry.bytes;
    if (entry.bytes > maxUnitBytes) flush();
  }
  flush();
  return units;
}

export function collectWarnings(entries, units) {
  const warnings = [
    ...entries.flatMap((entry) => entry.warnings ?? []),
    ...units.flatMap((unit) =>
      unit.entries.flatMap((entry) => entry.warnings ?? [])
    )
  ];
  for (const unit of units) {
    if (unit.oversized) {
      warnings.push(
        `Review unit ${unit.index + 1} exceeds the configured byte threshold; it was sent intact rather than truncated.`
      );
    }
  }
  return [...new Set(warnings)];
}
