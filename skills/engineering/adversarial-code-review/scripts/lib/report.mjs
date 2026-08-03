const leadingVerdict = /^Verdict: (approve|needs-attention)(?:\r?\n|$)/;
const anyVerdict = /^Verdict: (approve|needs-attention)\r?$/gm;

export const unresolvedVerdict = "manual-consolidation-required";

export function normalizeUnitReport(text) {
  const report = String(text ?? "").trim();
  const match = leadingVerdict.exec(report);
  if (!match) return { verdict: null, report };
  const stated = new Set(
    [...report.matchAll(anyVerdict)].map((line) => line[1])
  );
  if (stated.size > 1) return { verdict: null, report };
  return {
    verdict: match[1],
    report: report.slice(match[0].length).trim()
  };
}

export function overallVerdict(verdicts) {
  if (verdicts.includes("needs-attention")) return "needs-attention";
  if (verdicts.some((verdict) => verdict === null)) return unresolvedVerdict;
  return "approve";
}
