---
name: write-goal
description: Help users draft and refine a verifiable objective for an agent's persistent goal workflow, including completion evidence, scope boundaries, stop conditions, and an optional requested budget. Use when the user asks to create, write, or improve such a goal.
---

# Write a good goal (write-goal)

Help the user turn a rough intention into an objective that an agent's persistent goal workflow can pursue across many turns without supervision. A goal is not a task description — it is a completion contract. It says what must become *true*, how that truth is *proven*, where the work may and may not *reach*, and when to *stop and report* instead of grinding on.

This skill is about authoring the objective text together with the user. Distinguish drafting from starting. Start only when the user explicitly authorizes it and the host provides a goal-start capability.

## Adapt to the host

Detect the capabilities available in the current host. Treat tool names, parameters, confirmation behavior, budget units, and active-goal rules as host-specific. Use only capabilities and fields that the host exposes. If the host cannot start a persistent goal, return the approved objective and explain that limitation instead of inventing a command or parameter.

## Resolve missing decisions

Reuse the outcome, wording, scope, budget, and start authorization already supplied in the conversation. Draft directly when they are sufficient. Ask only about missing facts that materially change the objective or permitted work. Use the host's available input capability for useful choices, adapting to its mode and schema; otherwise ask one concise plain-text question. Treat wording alternatives as suggestions, not mandatory decisions.

## Rules of engagement

- **Only help when the user has asked for it.** Never volunteer to wrap an ordinary request in a goal, and never start one on your own. A normal "fix this test" is a normal request; treat it as a goal only when the user says they want a persistent goal. If a task looks suitable for a persistent goal workflow, you may mention that once — but wait for the user to choose.
- **Write in the user's language.** Draft the objective in whatever language the user is writing to you in. If the project configuration or a saved memory names a preferred language, honor that instead. Keep the surrounding discussion in the same language.
- **Honor the requested start boundary.** Return the full objective when the user asks only for drafting. If they explicitly request starting an exact supplied or already accepted objective, reuse that authorization. If they authorize drafting and starting, present the full objective and proceed when it stays within the specified scope; resolve any material scope change before starting.
- **Scale collaboration to the request.** Give a usable first draft and incorporate feedback when supplied. Do not require extra rounds when the user has provided enough information.
- **Respect the user's final call.** If, after you have pointed out what is vague or risky, the user still wants a looser or thinner goal, write the goal they asked for. Note the trade-off once; do not keep relitigating it or quietly "improve" the wording against their wishes.

## What makes a goal good

The strongest goals share one shape: they define **proof, not effort**. "Keep improving the code" describes effort and never ends. "Done when `npm test` exits 0 and no file outside `src/auth` changed" describes proof and is checkable. Aim for a contract with these parts:

1. **End state** — the condition that must become true. Name the finish line concretely: a passing suite, an empty queue, a search that returns zero matches, a deployed artifact.
2. **Proof** — the observable evidence that the end state holds. Prefer things the agent can run and you can inspect afterward: a command's exit code, a test count, a `grep`/`rg` with no hits, a file that now exists, a metric over a threshold.
3. **Boundaries** — what the work may and may not touch. Name the scope (which module, which directory) and the off-limits actions (do not edit the spec, do not change unrelated files, do not make destructive data changes).
4. **The loop** — when the work is iterative, say how to iterate: rerun the check after each change, work through the queue item by item, replay the failing cases until they pass.
5. **The stop rule** — how to end honestly when "done" is not reachable. A "stop and ask before widening scope" clause and an explicit blocked path ("if an external service is down, record it and move on") let the agent report instead of faking a pass or looping forever. This is about *honesty*, not a spending limit — keep it separate from any budget (see below).

Two habits make almost any goal better:

- **Make it queue-shaped.** Goals that shrink a list work best: failing tests, open issues, error traces, files to migrate, rows to process. A queue gives the agent a worklist and gives you a countable definition of done.
- **Lean on existing verification.** Tests, CI, type-checks, lint, eval suites, browser audits, and zero-match searches are leverage — they are what let a goal run unattended and still be trusted. If a task has no way to prove completion, help the user add one or reconsider whether a persistent goal workflow fits.

Longer runs are not better runs. A tight contract that finishes in a handful of turns beats an open-ended one that burns hours re-running the whole suite after every edit.

## Budgets are opt-in

Some hosts support turn, token, cost, or other budgets. Treat budgets as optional host capabilities. **Do not set a budget by default, and never bake an arbitrary cap into the objective text.** A well-specified goal already stops on its own — when the proof passes or a blocker is hit — so an arbitrary cap usually does nothing except risk cutting off work midway.

When a budget is genuinely useful — typically an open-ended or exploratory goal that could run long unattended — you may suggest one in a unit that the host supports and the user can evaluate. Let the user choose the value, and check whether it fits the work. If the requested value looks oversized, say so and offer a smaller one, but respect their final call. If the host does not support budgets, do not emulate one by adding an arbitrary cap to the objective.

## Workflow

1. **Establish the contract.** Extract the intended outcome, proof, scope, and blockers from the request. Ask only about a material gap that cannot be resolved from context.
2. **Draft the goal.** Write a concrete objective in the user's language. Use one or a few sentences for simple work and a short structured block for larger work. Explain only choices that help the user assess it.
3. **Complete the requested action.** Return the draft for a writing-only request. Incorporate supplied edits. Start only when explicitly authorized, using the exact agreed objective or the draft within an authorized “draft and start” request, and only the optional fields the host supports. Do not ask again for start authorization already given.

Read [references/goal-examples.md](references/goal-examples.md) when a complex objective needs a template or the user needs weak-to-strong examples.
