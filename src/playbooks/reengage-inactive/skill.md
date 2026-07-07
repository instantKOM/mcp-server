# Reengage inactive contacts (server-side composite)

This is a `composite` playbook: its steps run SERVER-SIDE and ENCAPSULATED by the
MCP gateway (issue #5197). The calling agent only triggers `playbook_reengage-inactive`
with inputs -- the multi-step orchestration below is executed by the server, not
by the customer LLM, and is never exposed as raw prompt.

## What it does

1. **Segment** -- calls `list_contacts` for the given `channelId`
   (bounded by `limit`) to establish the re-engagement audience.
2. **Draft** -- calls `create_broadcast` to create a re-engagement broadcast
   (draft) on the same channel with the provided `message`.

## Inputs

- `channelId` (number, required) -- the channel to re-engage.
- `message` (string, required) -- the broadcast message content.
- `limit` (number, default 100) -- audience sampling cap for the segment step.

## Guardrails (enforced by the runner, not this prose)

- Every step's tool is scope-checked up front against the caller's key. If the
  key cannot `send`, the run aborts before the broadcast is created.
- The number of tool calls per run is capped (tool-call budget).
- The `create_broadcast` step runs through the idempotency path, so a retried run
  does not create duplicate broadcasts.
- Pre-send safety (opt-out / template / 24h window) is enforced by the underlying
  send tooling (issues #5200-5204), not re-implemented here.
