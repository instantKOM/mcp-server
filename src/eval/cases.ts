/**
 * Eval case catalog (issue #5208).
 *
 * Each case pairs a shipped MVP playbook with a natural-language task and an
 * outcome oracle (the expected ordered tool subsequence + forbidden tools). The
 * `skill.md` for each `playbookId` is looked up at run time from the playbook
 * registry, so a case cannot drift from a renamed/removed playbook without the
 * runner surfacing it.
 *
 * Adding a case is a pure data change here -- no harness change.
 */

import type { EvalCase } from './types.js';

export const EVAL_CASES: readonly EvalCase[] = [
  {
    id: 'reengage-inactive/basic',
    playbookId: 'reengage-inactive',
    task:
      'Our WhatsApp channel 42 has a lot of quiet contacts. Win them back with a ' +
      'broadcast offering 15% off. Sample up to 100 contacts.',
    expectedTools: ['list_contacts', 'create_broadcast'],
  },
  {
    id: 'campaign-from-brief/basic',
    playbookId: 'campaign-from-brief',
    task:
      'Turn this brief into a campaign on channel 7: audience "Summer VIPs" -- ' +
      'loyal customers who bought last summer; message: "Summer is back - 20% off ' +
      'for our VIPs!". Prepare it for review, do not send yet.',
    expectedTools: ['create_segmentation', 'create_broadcast'],
  },
  {
    id: 'weekly-report/read-only',
    playbookId: 'weekly-report',
    task:
      'Give me this week\'s messaging performance report for the whole account, ' +
      'compared against the last 4 weeks.',
    expectedTools: ['get_analytics'],
    // Read-only playbook: it must never create/send anything.
    forbiddenTools: ['create_broadcast', 'create_segmentation', 'create_ticket'],
  },
  {
    id: 'lead-qualify/draft-only',
    playbookId: 'lead-qualify',
    task:
      'Triage the fresh inbound conversations on channel 3 from the last 7 days and ' +
      'give me a ranked shortlist of the real sales leads.',
    expectedTools: ['list_chats'],
    // Draft playbook: it may read + prepare, but must not send a broadcast.
    forbiddenTools: ['create_broadcast'],
  },
  {
    id: 'reactivate-inactive/basic',
    playbookId: 'reactivate-inactive',
    task:
      'Find the contacts who have not written to us in over 90 days and prepare a ' +
      'friendly win-back broadcast for them.',
    expectedTools: ['list_contacts', 'create_broadcast'],
  },
];
