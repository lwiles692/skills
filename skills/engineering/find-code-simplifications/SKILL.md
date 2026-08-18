---
name: find-code-simplifications
description: Find and assess non-obvious opportunities to reduce a codebase's surface area and conceptual complexity. Use for simplification audits, over-engineering reviews, dead or duplicate abstraction searches, dependency-versus-custom-code analysis, lifecycle or state-machine consolidation, superseded design-document cleanup, or requests to turn evidence-backed simplification ideas into reports, repository-native design notes, or targeted inline cleanup comments.
---

# Find Code Simplifications

Turn broad requests to "simplify the codebase" into a small set of well-supported proposals. Prefer deleting, merging, demoting, or reusing over merely rewriting. Keep judgment active: a simplification must reduce the behavior, API, state, or maintenance burden that future contributors must understand.

## Establish the local rules

1. Read the repository instructions, architecture documentation, dependency policy, compatibility commitments, and design-decision records that govern the target area.
2. Identify protected seams, supported variants, public APIs, persistent formats, and compatibility obligations before proposing their removal.
3. Determine what artifact the user requested. Report findings by default; edit code, add comments, or write design documents only when requested.
4. Use the repository's native terminology and documentation system. Do not invent an ADR, RFC, issue, or note hierarchy when none exists.

Treat tests and old design documents as evidence, not unquestionable specifications. Compare them with shipped behavior, current callers, and current product commitments.

## Survey before narrowing

Cover several independent surfaces before settling on candidates. Scale the survey to the user's requested breadth and prioritize areas with large production-code or dependency footprints:

- public APIs, configuration, events, registries, hooks, and extension seams;
- duplicated data representations, caches, projections, and serialization paths;
- async lifecycles, cancellation, retries, readiness, teardown, and ownership state;
- validation, copying, freezing, rollback, and other defensive machinery;
- packages, adapters, helpers, examples, scripts, tests, generated fixtures, and snapshots;
- custom parsers, matchers, schedulers, queues, backoff logic, and other infrastructure with standard-library or maintained-package alternatives.

When the user explicitly requests parallel agents or the active instructions require them, divide the survey by domain and require each agent to return call-site evidence and counterevidence. Otherwise perform the domains sequentially. Do not stop at the first plausible idea.

## Recognize strong candidates

Prefer candidates where one or more of these conditions hold:

- A method, event, option, helper, package, or format has no production consumer.
- Only tests, examples, comments, or documentation consume behavior that is not a current commitment.
- Multiple states or representations encode the same fact and can drift.
- Every implementation must satisfy an interface member that no caller uses.
- A package or layer exists only to support a small amount of test, demo, or glue code.
- Speculative flexibility creates branches, invalidation, rollback, or lifecycle behavior without a concrete owner or use case.
- Defensive machinery protects values that remain inside one trusted, typed ownership boundary.
- A language/runtime facility or healthy dependency can replace custom code while producing meaningful net deletion.
- A behavior change is acceptable because the resulting contract is smaller, coherent, and easier to explain.

Downgrade cosmetic cleanup, isolated naming changes, tool output without call-site inspection, and claims that code merely "looks complex." Combine related small findings only when they share one cause and one coherent removal boundary.

## Prove or reject each candidate

For every candidate:

1. Name the exact symbol, behavior, state, or layer to remove, merge, or demote.
2. Search exact identifiers and wire/config strings with `rg`; account for dynamic lookup, reflection, code generation, loaders, plugins, and external consumers.
3. Classify each consumer as production, non-production, or ambiguous. Inspect ambiguous examples, scripts, and migration tools before classifying them.
4. Trace the behavior end to end. Read callers, implementations, tests, docs, history, and decision records that explain why it exists.
5. State what becomes deletable: implementation, tests, fixtures, docs, exports, dependencies, schemas, migrations, or operational paths.
6. Identify the strongest reason to keep it. Reject or lower confidence when current evidence does not overcome that reason.
7. Estimate net simplification. Subtract replacement glue, migration code, compatibility shims, new dependency surface, and displaced complexity from the deletion.
8. Define focused verification for the proposed end state using the repository's own commands and risk profile.

Reject a candidate when it still has a supported production caller, removes an intentional variation without new evidence, merely relocates complexity, requires broad unrelated churn, or is primarily a product decision outside the request.

## Audit trust and lifecycle boundaries

For copies, freezes, validators, and callback capture, identify the data's source, trust boundary, and next owner. Same-process typed calls may safely borrow immutable values; parsed input, configuration, persistence, queues, workers, subprocesses, model/tool output, and wire data usually require ownership or validation.

For async code, map each state flag, sentinel, promise, cancellation path, disposer, and terminal outcome to an owner and transition. Look for several mechanisms tracking the same liveness or settlement fact. Preserve distinct machinery when it protects genuinely different concerns such as publication rollback, callback containment, outcome arbitration, resource ownership, or teardown reaching quiescence.

## Evaluate dependency substitutions

When replacing custom code with a builtin or package:

- map the candidate's exact semantics to the replacement and list uncovered behavior;
- verify runtime/version availability and the repository's dependency policy;
- assess maintenance, adoption, security posture, transitive footprint, and license fit;
- prefer builtins when they meet the contract;
- compare total deleted code, tests, and documentation with the adapter code and new operational burden.

Do not count a wrapper around equally complex behavior as simplification.

## Handle superseded decisions

Audit design records only when the user requests it or when an accepted simplification clearly makes a record obsolete. Follow repository-specific retention rules.

Before consolidating or deleting a record:

1. Identify the current owner of every live decision and inbound reference.
2. Distinguish full supersession from partial supersession. Persistent data, compatibility behavior, supported contracts, or still-relevant rejected alternatives make supersession partial.
3. Transfer unique rationale, alternatives, consequences, verification evidence, and reintroduction conditions to the current owner.
4. Repair inbound links and related indexes or counterparts.
5. Search filenames, identifiers, config keys, and wire strings after the change.

Keep history that prevents a likely repeated mistake. Discard inventories that only describe implementation already removed.

## Produce actionable output

Rank candidates by confidence and expected reduction, not novelty. For each candidate include:

- **Target**: the precise surface and relevant files or symbols;
- **Evidence**: production and non-production consumers, plus supporting architecture or history;
- **Change**: what to remove, merge, demote, or replace;
- **Net reduction**: code, APIs, states, tests, docs, dependencies, or concepts eliminated, including residual glue;
- **Tradeoff**: the strongest lost capability or reason to keep the current design;
- **Confidence**: high, medium, or low, with unresolved questions;
- **Verification**: observable acceptance criteria and focused checks.

Use repository-native design records for durable architectural proposals. Use short tagged TODO/FIXME comments only for local, actionable cleanup that does not need a design decision. Report rejected candidates when they clarify important intentional complexity.

Validate any edits with targeted checks, the repository's required test and validation commands, and `git diff --check`. Summarize the areas surveyed, deliberate exclusions, accepted and rejected candidates, edits made, and checks run.
