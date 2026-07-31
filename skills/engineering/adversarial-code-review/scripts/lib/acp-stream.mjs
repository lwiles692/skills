// Tool names that mutate the workspace or escape the review-only stance.
// Backends differ in casing and prefixing, so match on a normalized substring.
const mutatingTool =
  /\b(write|edit|patch|apply|create|delete|remove|move|rename|bash|shell|terminal|exec|command|run)\b/i;

function chunkText(update) {
  const content = update?.content;
  if (!content) return null;
  if (typeof content.text === "string") return content.text;
  return null;
}

function toolLabel(update) {
  const call = update?.toolCall ?? update;
  return String(call?.title ?? call?.kind ?? call?.rawInput?.command ?? "").trim();
}

/**
 * Read acpx's `--format json` output: one JSON-RPC message per line.
 *
 * The transport, not the model, decides three things here:
 *
 * - Which text is the reviewer's final report. Adapters emit startup banners as
 *   their own agent message, so consecutive `agent_message_chunk` updates are
 *   grouped into messages and only the last group is the report. Nothing has to
 *   be matched against report content to strip that noise.
 * - Whether a permission request was raised. Exit status is unreliable: a run
 *   that auto-approves a read and later has a write denied can still exit 0.
 * - Which tools actually ran. The review is read-only by prompt instruction,
 *   and some backends ignore ACP permission policy entirely, so a mutating tool
 *   call is recorded as an observed violation rather than assumed impossible.
 *
 * Unparseable lines are skipped: a backend that prints stray text must not make
 * the whole review unreadable.
 */
export function parseAcpStream(stdout) {
  const messages = [];
  let current = [];
  let permissionRequested = false;
  const mutatingTools = new Set();
  const seenToolCalls = new Set();

  function flush() {
    if (current.length === 0) return;
    messages.push(current.join(""));
    current = [];
  }

  for (const line of String(stdout ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (message?.method === "session/request_permission") {
      permissionRequested = true;
      continue;
    }
    const update = message?.params?.update;
    if (!update) continue;

    if (update.sessionUpdate === "agent_message_chunk") {
      const text = chunkText(update);
      if (text !== null) current.push(text);
      continue;
    }
    if (update.sessionUpdate === "tool_call") {
      const label = toolLabel(update);
      const key = `${update.toolCallId ?? ""}:${label}`;
      if (!seenToolCalls.has(key)) {
        seenToolCalls.add(key);
        if (mutatingTool.test(label)) mutatingTools.add(label);
      }
    }
    // Any non-chunk update ends the current assistant message.
    flush();
  }
  flush();

  return {
    report: messages.at(-1) ?? "",
    messages,
    permissionRequested,
    mutatingTools: [...mutatingTools]
  };
}
