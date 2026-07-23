function percentage(value) {
  return `${Math.round(value * 100)}%`;
}

export function renderMarkdown(result) {
  const lines = [
    "# Adversarial Code Review",
    "",
    `Reviewer: ${result.metadata.agent}`,
    `Target: ${result.metadata.target.label}`,
    `Verdict: ${result.verdict}`,
    "",
    result.summary,
    ""
  ];

  if (result.findings.length === 0) {
    lines.push("No material findings.", "");
  } else {
    lines.push("## Findings", "");
    result.findings.forEach((finding, index) => {
      lines.push(
        `### ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`,
        "",
        `Location: ${finding.file}:${finding.line_start}`,
        `Confidence: ${percentage(finding.confidence)}`,
        `Category: ${finding.category}`,
        "",
        finding.body,
        "",
        `Failure scenario: ${finding.failure_scenario}`,
        "",
        `Recommendation: ${finding.recommendation}`,
        ""
      );
    });
  }

  if (result.next_steps.length > 0) {
    lines.push("## Next steps", "");
    for (const step of result.next_steps) lines.push(`- ${step}`);
    lines.push("");
  }
  if (result.metadata.warnings.length > 0) {
    lines.push("## Coverage warnings", "");
    for (const warning of result.metadata.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  lines.push(
    `Reviewed ${result.metadata.files} file(s) in ${result.metadata.units} unit(s) via acpx ${result.metadata.acpx_version}.`,
    ""
  );
  return lines.join("\n");
}

