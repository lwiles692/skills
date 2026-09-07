# Specialized simplification assessments

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

