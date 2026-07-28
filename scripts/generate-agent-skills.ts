import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  effectiveRequiredScope,
  isPastSunset,
  playbookRegistry,
} from '../src/playbooks/registry.js';
import type { Playbook } from '../src/playbooks/types.js';
import { checkPlaybookContract } from '../src/tests/contract/contract-check.js';

export const AGENT_SKILLS_SCHEMA =
  'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const agentSkillsRoot = join(SCRIPT_DIR, '..', 'src', 'discovery', 'agent-skills');

export interface PublishedSkill {
  name: string;
  document: string;
  digest: string;
}

export interface AgentSkillsIndex {
  $schema: string;
  skills: Array<{
    name: string;
    type: 'skill-md';
    description: string;
    url: string;
    digest: string;
  }>;
}

function confirmationText(scope: string): string {
  if (scope === 'read') {
    return 'This skill is read-only. Do not request or perform a mutation while using it.';
  }
  return (
    'Before invocation, obtain explicit user confirmation for the described mutation. ' +
    'A key scope grants technical permission; it is not user consent.'
  );
}

export function renderSkillDocument(playbook: Playbook): string {
  const { meta } = playbook;
  const scope = effectiveRequiredScope(meta);
  return [
    '---',
    `name: ${meta.id}`,
    `description: ${JSON.stringify(meta.description)}`,
    '---',
    '',
    `# ${meta.name}`,
    '',
    '## Runtime contract',
    '',
    `- Delivery: \`${meta.delivery}\``,
    `- Minimum Agent Connect key scope: \`${scope}\``,
    `- Minimum subscription tier: \`${meta.minTier}\``,
    '- Authentication: send the tenant-bound Agent Connect key as a Bearer token.',
    `- Confirmation: ${confirmationText(scope)}`,
    '- Tenant, enabled-tool, PII-masking, rate-limit and audit gates are enforced by the MCP runtime. Never bypass or reproduce them client-side.',
    '- Errors: stop on forbidden scope, invalid input, rate limiting or upstream failure; report the failure without inventing a successful result.',
    '- Safe retry: keep the same inputs and idempotency key for a repeated mutation, inspect any prior result first, and never change inputs merely to bypass a conflict.',
    '',
    '## Workflow',
    '',
    playbook.skill,
    '',
  ].join('\n');
}

export function buildAgentSkills(playbooks: Playbook[]): {
  index: AgentSkillsIndex;
  skills: PublishedSkill[];
} {
  const executable = playbooks
    .filter(({ meta }) => !isPastSunset(meta))
    .sort((a, b) => a.meta.id.localeCompare(b.meta.id));

  const skills = executable.map((playbook) => {
    const violations = checkPlaybookContract(playbook);
    if (violations.length > 0) {
      throw new Error(
        `Cannot publish playbook '${playbook.meta.id}': ${violations.join('; ')}`
      );
    }
    const document = renderSkillDocument(playbook);
    const digest = `sha256:${createHash('sha256').update(document).digest('hex')}`;
    return { name: playbook.meta.id, document, digest };
  });

  return {
    index: {
      $schema: AGENT_SKILLS_SCHEMA,
      skills: skills.map(({ name, digest }) => {
        const playbook = executable.find(({ meta }) => meta.id === name)!;
        return {
          name,
          type: 'skill-md' as const,
          description: playbook.meta.description,
          url: `/.well-known/agent-skills/${name}/SKILL.md`,
          digest,
        };
      }),
    },
    skills,
  };
}

function expectedFiles(): Map<string, string> {
  const generated = buildAgentSkills(playbookRegistry.list());
  return new Map([
    ['index.json', `${JSON.stringify(generated.index, null, 2)}\n`],
    ...generated.skills.map(({ name, document }) => [`${name}/SKILL.md`, document] as const),
  ]);
}

function listArtifactFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];
  const walk = (directory: string, prefix = ''): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(directory, entry.name), relative);
      else result.push(relative);
    }
  };
  walk(root);
  return result;
}

export function verifyGeneratedAgentSkills(root = agentSkillsRoot): string[] {
  const expected = expectedFiles();
  const errors: string[] = [];
  for (const [relative, content] of expected) {
    const file = join(root, relative);
    if (!existsSync(file)) errors.push(`missing generated artifact: ${relative}`);
    else if (readFileSync(file, 'utf8') !== content) errors.push(`stale generated artifact: ${relative}`);
  }
  for (const relative of listArtifactFiles(root)) {
    if (!expected.has(relative)) errors.push(`orphan generated artifact: ${relative}`);
  }
  return errors;
}

function writeGeneratedAgentSkills(root = agentSkillsRoot): void {
  for (const [relative, content] of expectedFiles()) {
    const file = join(root, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf8');
  }
}

function main(): void {
  if (process.argv.includes('--write')) {
    writeGeneratedAgentSkills();
  }
  const errors = verifyGeneratedAgentSkills();
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.log(`[OK] Agent Skills match ${playbookRegistry.list().length} executable playbook(s).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
