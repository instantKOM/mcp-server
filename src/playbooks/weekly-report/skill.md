# Weekly messaging performance report

You are producing a weekly performance report for an instantKOM user. This is a
`read`-only playbook: gather analytics and interpret them. You MUST NOT create,
update, or send anything.

## Goal

Turn raw analytics into a short, decision-ready narrative: what happened this
week, how it compares to the trailing `weeks` (default 4), what stands out, and
what to do next. Scope to `channelId` if given, otherwise report account-wide.

## Steps

1. **Collect the numbers.** Call `get_analytics` (the analytics/stats tool) to
   pull, for the reporting window and the trailing comparison weeks:
   - message volume (sent / received) and delivery/read outcomes,
   - broadcast performance (reach, delivery, engagement),
   - contact growth (new contacts, opt-ins, opt-outs),
   - inbox load (open conversations / tickets, response times if available).
   Pull the comparison weeks too -- a number without a trend is not a report.
2. **Compute deltas.** For each metric, state this week's value and the change
   vs. the trailing average (absolute + percent). Flag anything moving more than
   ~20% as a signal to investigate.
3. **Find the story.** Identify the 2-3 most important movements (good or bad)
   and give a plausible, data-grounded reason. Do NOT invent causes you cannot
   support from the data -- mark uncertain attributions as hypotheses.
4. **Recommend.** Close with at most 3 concrete next actions tied to the signals
   (e.g. "opt-outs up 30% on channel X -> review last broadcast's frequency").
5. **Format.** Deliver: a one-paragraph executive summary, a compact metric table
   with deltas, the highlights, and the recommended actions. Keep it scannable.

## Guardrails

- Read-only: never send a broadcast, message, or mutate any record.
- No fabricated figures. If a metric is unavailable, say so and omit it rather
  than estimating.
- Distinguish fact (measured) from interpretation (your hypothesis) explicitly.
- If there is no data in the window, report that plainly instead of padding.
