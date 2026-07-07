# Campaign from a brief (server-side composite)

This is a `composite` playbook: its steps run SERVER-SIDE and ENCAPSULATED by the
MCP gateway (issue #5197). The calling agent only triggers
`playbook_campaign-from-brief` with inputs -- the orchestration below is executed
by the server, not the customer LLM, and is never exposed as raw prompt.

## What it does

Turns a one-line campaign brief into two linked artifacts the user can review
before anything goes out:

1. **Segment** -- calls `create_segmentation` to create a named audience
   segmentation from the brief. The brief text is stored as the segment
   description so the intended audience and goal are captured alongside the
   campaign.
2. **Draft** -- calls `create_broadcast` to create a broadcast (draft,
   `sendStatus` defaults to draft) on the target `channelId` carrying the
   campaign copy.

The broadcast is created as a DRAFT: this playbook prepares the campaign, it does
not dispatch it. The user (or a separate, explicitly-confirmed send step) reviews
audience + copy before any message reaches recipients.

## Inputs

- `channelId` (number, required) -- channel the campaign broadcast is drafted on.
- `segmentName` (string, required) -- name of the audience segment.
- `brief` (string, required) -- audience + goal, stored as the segment description.
- `message` (string, required) -- campaign copy (max 4096 characters).

## Guardrails (enforced by the runner, not this prose)

- Every step's tool is scope-checked up front against the caller's key. A key
  that cannot `send` aborts the run before any segment or broadcast is created.
- The tool-call budget caps the number of tool calls per run.
- Mutating steps run through the idempotency path, so a retried run does not
  create duplicate segments or broadcasts.
- The broadcast is left in draft state; pre-send safety (opt-out / template /
  24h window) is enforced by the underlying send tooling (issues #5200-5204) at
  actual send time, not re-implemented here.
