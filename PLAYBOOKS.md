# Agent Connect Playbooks -- Reference

Playbooks are curated, higher-level workflows served over Agent Connect on top
of the base MCP tools. This page lists the shipped playbooks and points to the
authoring + versioning rules. For the connect + run flow, see
[AGENT_CONNECT.md](./AGENT_CONNECT.md).

Values below are sourced directly from each playbook's `src/playbooks/<id>/meta.json`.

## Delivery modes

- **`prompt`** -- surfaced via **`prompts/list` / `prompts/get`**. The
  `skill.md` body becomes the prompt; the client runs it locally, calling base
  tools itself.
- **`composite`** -- surfaced via **`tools/list`** as a single callable tool
  **`playbook_<id>`**; the server runs the whole workflow in one encapsulated
  run.

Every playbook is gated by the connecting key's **scope** and **tier**. All 5
MVP playbooks require **`minTier: business`**.

## Shipped playbooks (5 MVP)

| id | Delivery | requiredScope | minTier | What it does | Inputs |
|----|----------|---------------|---------|--------------|--------|
| **reactivate-inactive** | prompt | `send` | business | Find contacts with no recent inbound activity and draft a personalized re-engagement newsletter. | `inactiveSinceDays` (number, default 90) |
| **reengage-inactive** | composite | `send` | business | Segment a channel's contacts and create a re-engagement newsletter **draft** in one server-side run. | `channelId` (number, req), `message` (string, req), `limit` (number, default 100) |
| **lead-qualify** | prompt | `draft` | business | Score fresh inbound conversations against a rubric, tag them, and prepare a routing recommendation + reply draft -- without sending. | `channelId` (number, req), `lookbackDays` (number, default 7) |
| **weekly-report** | prompt | `read` | business | Pull the week's messaging/newsletter/contact analytics into a concise narrative report with trends, anomalies, next actions. | `channelId` (number, optional), `weeks` (number, default 4) |
| **campaign-from-brief** | composite | `send` | business | Turn a short brief into an audience segment + a ready-to-review newsletter **draft** on the target channel, server-side. | `channelId` (number, req), `segmentName` (string, req), `brief` (string, req), `message` (string, req, max 4096 chars) |

### Composite step chains

For transparency, the two `composite` playbooks run these tool steps
server-side (from `meta.json` `steps`):

- **reengage-inactive**: `list_contacts` (segment) -> `create_broadcast` (draft).
- **campaign-from-brief**: `create_segmentation` -> `create_broadcast` (draft).

Both stop at a **draft** -- nothing is sent to recipients automatically.

## How playbooks are versioned

Each `meta.json` carries a SemVer `version` and clients record runs by
`id@version`. Deprecation/sunset and compatibility rules are the authoritative
contract in
[`src/playbooks/VERSIONING.md`](./src/playbooks/VERSIONING.md) (issue #5199).

## How to author a playbook

A playbook is a directory `src/playbooks/<id>/` with:

- **`meta.json`** -- id, name, `version`, `description`, `requiredScope`
  (`read`/`draft`/`send`), `delivery` (`prompt`/`composite`), `minTier`, `tags`,
  and an `inputs` map. `composite` playbooks additionally declare `steps`
  (`{ id, tool, args }`, with `{{inputs.x}}` interpolation).
- **`skill.md`** -- for `prompt` playbooks, the guidance body served as the MCP
  prompt.

The registry (`src/playbooks/registry.ts`) reads playbooks **live** from disk
and validates them; serving (`src/playbooks/serving.ts`) applies scope + tier
gating. Adding or removing a directory changes what is served with no code
deploy. Follow `VERSIONING.md` when changing an existing playbook's contract.
