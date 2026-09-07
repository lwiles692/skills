# Goal examples

## A reusable shape

For a non-trivial goal, this fill-in-the-blanks structure covers the contract:

```
<What must become true.>
Done when <command/search/state that proves it>.
Scope: only <files/area>; do not <off-limits action>.
Loop: <how to iterate — rerun the check after each change, etc.>.
If <blocking condition>, stop and report instead of forcing a pass.
```

Not every goal needs every line, and none of them is an execution cap — the goal stops when the proof passes or a blocker is hit. A small, well-scoped task can be a single clear sentence. Add structure as the work grows or the cost of a wrong autonomous run rises.

## Weak to strong

- Weak: `Find all bugs in this codebase.` — no finish line, no proof, no stop. The agent may block at once or run far past what you wanted.
  Strong: `Fix every test in test/auth that currently fails, rerun npm test until it exits 0, change no file outside test/ or src/auth, and report anything you cannot fix with its location and why.`
- Weak: `Optimize the project.` — no scope, no measure.
  Strong: `Migrate the payment module to the new API, make npm test -- payment exit 0, keep the diff limited to payment-related files, and stop and ask before touching shared infrastructure.`
- Weak: `Make it faster.`
  Strong: `Make renderFrame at least 3x faster measured by the bench/render benchmark; if you cannot reach 3x after several attempts, report the best result and why.`

## Common mistakes

| Mistake | Better |
| --- | --- |
| Starting or suggesting a goal the user did not ask for | Only draft a goal once the user asks; mention the option at most once otherwise |
| Drafting in English when the user is writing in another language | Match the user's language (or the project / memory preference) |
| Starting without explicit user authorization | Reuse existing start authorization, or return the draft |
| Polishing the goal silently against the user's stated wishes | Note the trade-off once, then write the goal they asked for |
| Asking again about a supplied decision | Reuse the supplied choice; ask only about material gaps |
| Specifying effort ("keep improving X") | Specify proof ("done when check X passes") |
| Baking an execution cap into the objective or setting a budget unprompted | Let the goal stop on its proof; suggest only a useful budget that the host supports |
| No blocked path | Add an explicit "stop and report" rule for blockers |
| A goal with no way to verify completion | Anchor it to tests, a search, a metric, or another inspectable check |
