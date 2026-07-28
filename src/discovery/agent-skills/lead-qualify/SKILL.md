---
name: lead-qualify
description: "Score a fresh inbound conversation against a qualification rubric, tag it, and prepare a routing recommendation and reply draft without sending anything."
---

# Qualify and route an inbound lead

## Runtime contract

- Delivery: `prompt`
- Minimum Agent Connect key scope: `draft`
- Minimum subscription tier: `business`
- Authentication: send the tenant-bound Agent Connect key as a Bearer token.
- Confirmation: Before invocation, obtain explicit user confirmation for the described mutation. A key scope grants technical permission; it is not user consent.
- Tenant, enabled-tool, PII-masking, rate-limit and audit gates are enforced by the MCP runtime. Never bypass or reproduce them client-side.
- Errors: stop on forbidden scope, invalid input, rate limiting or upstream failure; report the failure without inventing a successful result.
- Safe retry: keep the same inputs and idempotency key for a repeated mutation, inspect any prior result first, and never change inputs merely to bypass a conflict.

## Workflow

# Qualify and route an inbound lead

You are helping an instantKOM user triage fresh inbound conversations so real
sales opportunities are not lost in a noisy inbox. This is a `draft` playbook:
you may READ inbox data and PREPARE tags, notes and a reply draft, but you MUST
NOT send anything or auto-create records without explicit user confirmation.

## Goal

For the given `channelId`, review conversations whose first inbound message is
within `lookbackDays` (default 7), score each against the rubric below, and hand
the user a ranked, actionable shortlist.

## Qualification rubric (score each 0-3, judgement required)

Do NOT treat this as a keyword match -- read the actual message intent.

1. **Need / intent.** Does the contact express a concrete problem, purchase
   intent, or question that maps to what the user sells? (0 = spam/off-topic,
   3 = explicit buying intent.)
2. **Fit.** Do signals (company mentioned, volume, use case, region/language)
   fit the user's target customer? Unknown fit scores 1, not 0.
3. **Timing / urgency.** Is there a deadline, active evaluation, or "we need
   this now" signal?
4. **Reachability.** Is the contact opted in and within a messaging window so a
   reply can actually be delivered?

Total 9-12 = **hot**, 5-8 = **nurture**, 0-4 = **disqualify**.

## Steps

1. **Gather.** Call `list_chats` (the inbox/chat listing tool) to collect the
   recent inbound conversations on `channelId`. If none match, say so and stop --
   never invent leads.
2. **Enrich.** For borderline leads, pull the contact record and its tags to
   inform Fit and Reachability. Never guess opt-in status -- read it.
3. **Score.** Apply the rubric per conversation. Show the per-criterion scores
   and the one-line reason, not just the total. Rank hot -> nurture -> disqualify.
4. **Prepare routing.** For each hot lead, propose: a qualification tag (e.g.
   `lead-hot`), a one-sentence internal note, and a SHORT first-reply draft in the
   contact's language. For nurture leads, propose only a tag. Disqualified leads
   get no outreach.
5. **Confirm before mutating.** Present the shortlist and drafts. Only after the
   user confirms should you apply tags, create tickets, or hand drafts to the
   send flow. Tagging/ticketing is the user's decision, not yours.

## Guardrails

- Never send a message or broadcast from this playbook -- you draft, the user
  sends.
- Respect opt-out and suppression: a disqualified or opted-out contact is never
  drafted an outreach message.
- Be conservative: when intent is ambiguous, score down and label `nurture`
  rather than inflating a lead to `hot`.
- One rubric, one pass. Do not fabricate scores for conversations you could not
  read.
