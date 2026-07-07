# Agent Connect -- Connect Flow Guide

Agent Connect lets you drive your instantKOM Messengerzentrale from your **own**
AI assistant (Claude, ChatGPT, or any MCP-capable client) over the hosted
Remote-MCP gateway. You connect with a single URL and an API key -- no repo
clone, no Node install, no self-hosting.

This guide takes a developer/integrator from zero to running a playbook
end-to-end using only these docs.

> **BYO-LLM.** Agent Connect is bring-your-own-LLM: your AI subscription, your
> prompts, your tokens. instantKOM never sees your prompts or LLM tokens -- it
> only exposes tools + playbooks and processes the results.

---

## 1. What Agent Connect is (2 stages)

Agent Connect surfaces two kinds of capability, gated per key:

| Stage | What the client sees | Backed by |
|-------|----------------------|-----------|
| **Base tools** | ~230 MCP tools for Channels, Contacts, Messages, Newsletters, Analytics, Bots, Flows... | The instantKOM REST API, one tool per operation |
| **Playbooks** | Curated, higher-level workflows (`prompt` guides and `composite` server-side runners) | `src/playbooks/<id>/` -- see [PLAYBOOKS.md](./PLAYBOOKS.md) |

Both are filtered by the connecting key's **scope** (`read`/`draft`/`send`) and
**plan tier** (playbooks require **Business+**). A read-only key never even sees
a mutating tool.

---

## 2. Prerequisites

1. **Your own AI subscription** with MCP support -- e.g. Claude
   (Desktop / Code) or ChatGPT with a custom MCP connector.
2. **A Business+ instantKOM account.** Playbooks and Agent Connect are
   tier-gated to **Business and above** (issue #5213). Lower tiers can still
   connect base tools within their scope, but see no playbooks.
3. **An Agent-Connect key** (next step).

---

## 3. Create + scope a key

Create the key in the Messengerzentrale under **Settings > API-Keys**
("Agent-Connect-Key erstellen", issue #5210). When creating it you choose the
**scope**, which is the trust ceiling for everything the key can do:

| Scope | Grants | Typical use |
|-------|--------|-------------|
| `read` | read-only tools (get/list/search/export/analytics) | reporting, dashboards |
| `draft` | read **plus** prepare-without-send tools (e.g. `generate_ai_reply`) | assisted drafting, human-in-the-loop |
| `send`  | read + draft **plus** all mutations (create/update/delete/send) | full automation |

Scopes are hierarchical: `read < draft < send`. A `send` key implicitly holds
`read` and `draft`.

> **PII consent (issue #5211).** Exposing contact personal data to an external
> LLM requires explicit PII consent on the account/key. Until consent is given,
> PII-bearing responses are guarded (`AGENT_PII_EXPOSURE`). Grant consent in the
> key creation flow if your workflow needs contact details.

Copy the key value on creation -- it is shown once.

---

## 4. Connect your client

Point your MCP client at the Agent Connect gateway endpoint and authenticate
with `Authorization: Bearer <your-key>`.

> ### [PLACEHOLDER] MCP endpoint URL
> The production gateway URL is **not finalized yet**. Until it is confirmed,
> this doc uses the same clearly-labelled placeholder as the landing page
> (issue #5216, `services/start/specifics/mcp.php`):
>
> ```
> https://api.instantkom.app/mcp
> ```
>
> Replace it everywhere once the final route is decided
> (`services/mcp-server`, gateway #5190). The gateway serves StreamableHTTP at
> `/mcp` (preferred) and legacy SSE at `/mcp/sse` + `/mcp/messages`; local
> default port is `MCP_HTTP_PORT=3005`, bin `instantkom-mcp-http`.

### Claude Desktop / Claude Code

Uses the `mcp-remote` bridge (identical shape to the #5216 landing snippet):

```json
{
  "mcpServers": {
    "instantkom-agent-connect": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://api.instantkom.app/mcp",
        "--header",
        "Authorization: Bearer ${INSTANTKOM_AGENT_KEY}"
      ]
    }
  }
}
```

Set `INSTANTKOM_AGENT_KEY` in your environment to the key from step 3.

### ChatGPT / generic MCP client

```json
{
  "name": "instantKOM",
  "url": "https://api.instantkom.app/mcp",
  "auth": {
    "type": "bearer",
    "token": "<YOUR_AGENT_CONNECT_KEY>"
  }
}
```

The key is re-validated on **every** request (the gateway is stateless), so a
revoked key stops working immediately.

---

## 5. Discover + run a playbook

Playbooks are delivered two ways, discoverable via standard MCP:

- **`prompt` playbooks** appear in **`prompts/list`** (and are fetched with
  `prompts/get`). The client runs them locally by following the returned
  guidance and calling base tools itself.
- **`composite` playbooks** appear in **`tools/list`** as a single callable
  tool named **`playbook_<id>`** (e.g. `playbook_reengage-inactive`). The
  server executes the whole workflow in one encapsulated run.

Only the playbooks your key's scope **and** tier allow are returned.

### End-to-end example: `reengage-inactive` (composite, `send`)

Goal: segment a channel's contacts and create a re-engagement newsletter **draft**
in one server-side run.

1. **Discover** -- call `tools/list`; confirm `playbook_reengage-inactive` is
   present (needs a `send` scope + Business tier).
2. **Invoke** the tool with its inputs:

   | Input | Type | Required | Meaning |
   |-------|------|----------|---------|
   | `channelId` | number | yes | Channel whose contacts to re-engage |
   | `message` | string | yes | Newsletter message content |
   | `limit` | number | no (default 100) | Max contacts sampled when sizing the segment |

   ```json
   {
     "name": "playbook_reengage-inactive",
     "arguments": {
       "channelId": 42,
       "message": "Hi! We haven't heard from you in a while -- here's what's new.",
       "limit": 100
     }
   }
   ```

3. **Expected outcome:** the runner executes two steps server-side --
   `list_contacts` (segment) then `create_broadcast` (draft) -- and returns the
   created **newsletter draft**. Nothing is sent to recipients; you review and
   send the draft from the Messengerzentrale.

> Prefer a client-guided variant? Use the `prompt` playbook
> **`reactivate-inactive`** instead: it appears in `prompts/list`, takes
> `inactiveSinceDays` (default 90), and walks your assistant through finding
> inactive contacts and drafting the newsletter using base tools.

---

## 6. Scopes, safety & limits

| Guardrail | Behavior | Pointer |
|-----------|----------|---------|
| **Read XOR send** | Every tool is classified `read`/`draft`/`send`; a call is either a read or a mutation, never mixed. A read-only key cannot see mutating tools. | #5192/#5202, `src/tools/tool-scopes.ts` |
| **Idempotency** | Mutating (`send`) calls should carry an `Idempotency-Key` header (or `params._meta.idempotencyKey` / `args.idempotencyKey`); the API dedups replays. | #5193, `src/http/idempotency.ts` |
| **Rate limits** | Per-key limiter (default 120 requests / 60s window). Env: `MCP_RATE_LIMIT_MAX`, `MCP_RATE_LIMIT_WINDOW_MS`. | #5194, `src/http/rate-limiter.ts` |
| **Audit log** | Every tool call and playbook run is logged and attributable. | #5204/#5212/#5214, `src/http/audit-log.ts` |
| **PII exposure** | Contact PII is guarded unless consent is granted on the key. | #5211/#5203, `src/http/pii-guard.ts` |

Key resolution + scopes come from `GET {apiUrl}/auth/mcp/introspect`
(`src/http/apis2-auth-resolver.ts`).

---

## Related docs

- [PLAYBOOKS.md](./PLAYBOOKS.md) -- the 5 shipped playbooks (ids, scopes,
  tiers, inputs) + authoring/versioning pointers.
- [README.md](./README.md) -- MCP server overview + base tool catalog.
- [CLAUDE_CODE_SETUP.md](./CLAUDE_CODE_SETUP.md) -- local (stdio) Claude Code
  setup.
- [../api/docs/MCP_SETUP_GUIDE.md](../api/docs/MCP_SETUP_GUIDE.md),
  [../api/docs/MCP_SERVER_CONFIG.md](../api/docs/MCP_SERVER_CONFIG.md).
