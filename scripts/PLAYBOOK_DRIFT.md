# Playbook drift self-heal loop (#5209, Agent-Connect EPIC 4)

Playbooks reference concrete MCP tools, arg keys and scopes. When the API/tool
surface changes (a tool is renamed/removed, an arg key drops out of a DTO, a
scope changes), a shipped playbook can silently **drift** out of contract. This
loop detects that drift nightly and drives a gated self-heal.

## The loop

```
detect  ->  report  ->  fix  ->  gate  ->  merge
```

| Stage | What | Where |
|-------|------|-------|
| **detect** | Re-run the #5206 FORM contract over every shipped playbook vs. the CURRENT tool registry. Non-zero exit = drift. | `scripts/check-playbook-drift.ts` (`npm run check:playbook-drift`) |
| **report** | On drift, open (or update, deduped) one triage issue with the structured report. | `.github/workflows/ci-mcp-playbook-drift.yml` (nightly `schedule` + `workflow_dispatch`) |
| **fix** | Author or self-heal agent edits the offending playbook step (or the tool), and, if the outcome changed, the #5207 golden. | PR against `dev` |
| **gate** | The REQUIRED contract (#5206) + golden (#5207) checks validate the fix. Both run in the `contract` vitest project via `ci-mcp-server.yml`. | `npm run test:contract` in CI |
| **merge** | Merge happens ONLY when the required checks are green. Red gate => escalate to a human. | Branch protection |

## AK4 — detection triggers a fix

`check:playbook-drift` is the deterministic trigger. It exits:

- `0` — no drift (all shipped playbooks satisfy the current tool contract)
- `1` — drift: prints a Markdown report naming `playbook -> step -> tool/arg` for
  every violation; the nightly workflow turns that report into a triage issue
  labelled `mcp-server` + `needs-review` (both allowlisted in `.github/labels.yml`)
- `2` — the shipped catalog failed to even load (registry meta contract broke) —
  surfaced distinctly because it is a harder break than surface drift

A **simulated** drift (a fixture playbook whose step points at a since-removed
tool, or passes an arg the tool no longer declares) is proven to be reported by
`src/tests/contract/playbook-drift.test.ts`; the same test asserts the shipped
catalog and a well-formed fixture report zero drift (exit 0).

## AK5 — merge only on green, else escalate

There is **no blanket auto-merge** and branch protection is **not** weakened. The
"auto-merge only on green" property is realized purely by the existing REQUIRED
status checks on the fix PR:

- The contract (#5206) and golden (#5207) suites are the required gate.
- If they pass, the fix is safe to merge (optionally via GitHub's native
  "auto-merge when checks pass").
- If they fail, the PR cannot merge — the escalation path is a human reviewer.

The nightly workflow only **detects and reports**. It never merges and never
edits branch protection.

## Run it locally

```bash
cd services/mcp-server
npm run check:playbook-drift     # exit 0 when the shipped catalog is clean
npm run test:contract            # includes the drift self-proof + #5206/#5207
```

## Owner decisions (not automated here)

- Enabling GitHub **auto-merge** on self-heal fix PRs is optional and left to the
  owner; the required-checks gate holds regardless.
- Whether a self-heal **agent** (vs. a human) authors the fix PR is an
  orchestration choice outside this repo's CI.
