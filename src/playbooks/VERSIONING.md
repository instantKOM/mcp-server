# Playbook Versioning & Deprecation Policy

Agent-Connect EPIC 2 (issue #5199). A playbook's `version` is a **public
contract**. Clients discover, run and record playbooks by `id@version`, so a
version must mean the same thing forever. This file is the authoritative,
enforced policy; the registry (`registry.ts`) validates it and serving
(`serving.ts`) surfaces it.

## Semantic Versioning (SemVer 2.0.0)

Every `meta.json` carries a valid `version` (`MAJOR.MINOR.PATCH`). Bump it by the
**largest** applicable change:

| Bump      | When                                                                                         |
| --------- | -------------------------------------------------------------------------------------------- |
| **MAJOR** | Breaking change: removed/renamed/retyped **inputs**, changed **output shape**, or changed **behavior/semantics** a caller could depend on. |
| **MINOR** | Additive, backward-compatible: new optional input, new tags, added step that does not change existing outputs. |
| **PATCH** | Backward-compatible fix: wording, prompt copy, bug fix that keeps inputs/outputs/behavior.    |

**No silent breaking change.** If a change would break an existing caller, it is
a MAJOR bump — never shipped under the same or a MINOR/PATCH version.

## Version is discernible in output

The running version is surfaced everywhere a client can observe a playbook:

- **prompts/list & tools/list** — description carries ` (vX.Y.Z)`, and a `_meta`
  block carries `{ playbookId: "id@version", playbookVersion }`.
- **prompts/get** — the returned `description`, a `_meta` block, and a
  `<!-- playbook: id@version -->` marker prepended to the rendered message.
- **composite run result** — the structured JSON summary carries
  `playbookVersion`, and the text line names `id@version`.

## Deprecation contract

A playbook is retired **gradually and visibly**, never yanked. Set in `meta.json`:

| Field               | Meaning                                                             |
| ------------------- | ------------------------------------------------------------------ |
| `deprecated`        | `true` to mark the playbook deprecated.                            |
| `deprecatedSince`   | Semver at which it became deprecated (optional, must be semver).   |
| `supersededBy`      | Id of the replacement playbook (the migration target).            |
| `deprecationReason` | Human-readable reason it is going away.                            |
| `sunsetAfter`       | Boundary after which it stops being served: ISO date `YYYY-MM-DD` **or** a semver. |

**Registry enforcement** (fails loudly at load):

- `deprecated: true` **requires a migration path**: at least one of
  `supersededBy` or `deprecationReason`.
- `deprecatedSince` must be valid semver; `sunsetAfter` must be a valid ISO date
  or semver.
- The deprecation-only fields must not appear without `deprecated: true`.

**Serving rule (list vs. exclude):**

- While deprecated **and before sunset**: the playbook is **still served**, but
  marked — a `[DEPRECATED] ... -- use '<supersededBy>' instead` description and a
  `_meta.deprecated` flag — so clients are **warned, not surprised**.
- **After sunset** (`sunsetAfter` date has passed, or the running `version` is
  `>=` the sunset semver): the playbook is **excluded** from the served surface
  (prompts/list, tools/list, prompts/get, tool calls). The registry itself keeps
  listing it so version/admin tooling can still inspect it.

## Deprecation window

Give a sunset window long enough for clients to migrate (recommended: at least
one MINOR release cycle, or a dated window announced with `deprecatedSince`).
Ship the replacement (`supersededBy`) **before** the sunset passes.
