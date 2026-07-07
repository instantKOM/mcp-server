# Reactivate inactive contacts

You are helping an instantKOM user win back contacts who have gone quiet. Work
through the steps below, confirming with the user before anything is sent.

## Goal

Identify contacts with no inbound activity for a while (default: 90 days, or the
`inactiveSinceDays` input if provided) and prepare a friendly, personalized
re-engagement broadcast.

## Steps

1. **Segment.** Call `list_contacts` to gather contacts whose most
   recent inbound message is older than `inactiveSinceDays`. Report how many
   contacts match before doing anything else.
2. **Understand context.** Look at what these contacts previously engaged with
   (topics, tags, last broadcast they reacted to) so the outreach feels relevant.
3. **Draft.** Compose ONE short broadcast message:
   - Acknowledge it has been a while, warmly and without guilt-tripping.
   - Offer a concrete reason to re-engage (news, an update, an incentive the user
     names).
   - Include a single clear call to action.
   - Respect the channel's formatting and length limits.
4. **Review with the user.** Show the segment size and the draft. Ask the user to
   confirm the audience and wording. Never send without explicit confirmation.
5. **Send.** Only after confirmation, call `create_broadcast` to dispatch the
   re-engagement broadcast to the segment.
6. **Summarize.** Report what was sent, to how many contacts, and suggest a
   follow-up window to measure re-engagement.

## Guardrails

- Honor opt-outs and suppression: never message contacts who have unsubscribed.
- One broadcast, one audience per run. Do not fan out multiple sends.
- If no contacts match, say so and stop -- do not invent an audience.
