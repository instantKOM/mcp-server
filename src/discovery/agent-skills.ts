import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENT_SKILLS_INDEX_PATH = '/.well-known/agent-skills/index.json';
const SKILL_PATH = /^\/\.well-known\/agent-skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md$/;
const ASSET_ROOT = join(dirname(fileURLToPath(import.meta.url)), 'agent-skills');

interface SkillsIndex {
  skills: Array<{ name: string }>;
}

export interface AgentSkillAsset {
  content: string;
  contentType: 'application/json' | 'text/markdown';
}

export function getAgentSkillAsset(path: string): AgentSkillAsset | null {
  if (path === AGENT_SKILLS_INDEX_PATH) {
    return { content: readFileSync(join(ASSET_ROOT, 'index.json'), 'utf8'), contentType: 'application/json' };
  }

  const match = SKILL_PATH.exec(path);
  if (!match) return null;
  const name = match[1];
  const index = JSON.parse(readFileSync(join(ASSET_ROOT, 'index.json'), 'utf8')) as SkillsIndex;
  if (!index.skills.some((skill) => skill.name === name)) return null;
  return {
    content: readFileSync(join(ASSET_ROOT, name, 'SKILL.md'), 'utf8'),
    contentType: 'text/markdown',
  };
}
