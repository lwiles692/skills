const leadingVerdict = /^Verdict: (approve|needs-attention)(?:\r?\n|$)/;
const anyVerdict = /^Verdict: (approve|needs-attention)\r?$/gm;

export const unresolvedVerdict = "manual-consolidation-required";

/**
 * Two independent conditions, because they defend against different failures:
 *
 * - The verdict must lead the report. The transport has already isolated the
 *   reviewer's final message, so this is the verdict's one legitimate position;
 *   requiring it stops repository text, a quoted contract fragment, or an
 *   echoed example further down from deciding the run.
 * - No later line may state a different verdict. A model that opens with
 *   `approve` and then corrects itself to `needs-attention` is not approving,
 *   and the stale first value must not outvote the correction.
 *
 * Either failure leaves the unit unreadable rather than decided. A repeated
 * verdict that agrees with the first one is harmless and stays readable.
 *
 * The accepted line is consumed, because the runtime reprints it in the header.
 */
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

/**
 * Conservative execution-level verdict. Any unit that needs attention decides
 * the run; otherwise an unreadable unit blocks an approve claim.
 */
export function overallVerdict(verdicts) {
  if (verdicts.includes("needs-attention")) return "needs-attention";
  if (verdicts.some((verdict) => verdict === null)) return unresolvedVerdict;
  return "approve";
}
