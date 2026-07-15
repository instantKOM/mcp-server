/**
 * Playbook registry (Agent-Connect EPIC 2, issue #5195).
 *
 * Discovers playbook directories on disk, parses + validates their `meta.json`
 * and `skill.md`, caches the result, and exposes lookup + filtering helpers
 * that #5196 (serving) will call.
 *
 * ACCEPTANCE (AK2 EPIC 2): a new playbook is added by a pure file/registry
 * change -- dropping a `<id>/{skill.md,meta.json}` directory under the
 * playbooks root. No code deploy, no registration call. The fs scan discovers
 * it on the next `load()`/`reload()`.
 *
 * Invalid playbooks FAIL LOUDLY at load: `load()` throws a
 * `PlaybookValidationError` naming the offending file, so a broken playbook
 * cannot silently disappear from the catalog.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  PLAYBOOK_DELIVERIES,
  PlaybookValidationError,
  type Playbook,
  type PlaybookDelivery,
  type PlaybookMeta,
  type PlaybookStep,
} from './types.js';
import {
  FINE_SCOPES,
  grantedScopeLevel,
  isToolAllowedForScopes,
  compositeRequiredScope,
  resolveToolScope,
  type ToolScope,
} from '../tools/tool-scopes.js';
import { stringifyUnknown } from '../types/stringify-unknown.js';

/**
 * Semantic Versioning 2.0.0 grammar (the official regex from semver.org,
 * anchored). Kept inline to avoid adding a dependency for one check.
 */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** True when `v` is a valid SemVer 2.0.0 string. */
export function isValidSemver(v: unknown): v is string {
  return typeof v === 'string' && SEMVER_RE.test(v);
}

/** Strict `YYYY-MM-DD` ISO calendar date (also checks it is a real date). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `v` is a valid `YYYY-MM-DD` ISO calendar date. */
export function isValidIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) {
    return false;
  }
  const ts = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(ts)) {
    return false;
  }
  // Reject roll-overs (e.g. 2026-02-30 -> Mar 02): round-trip must be identical.
  return new Date(ts).toISOString().slice(0, 10) === v;
}

/**
 * Compare two SemVer 2.0.0 strings, returning <0 / 0 / >0 (a<b / a==b / a>b).
 * Implements the 2.0.0 precedence rules: numeric MAJOR.MINOR.PATCH compared
 * numerically, then a version WITH a pre-release has LOWER precedence than the
 * same version without one; pre-release identifiers are compared field-by-field
 * (numeric < numeric numerically, identifiers alphabetically, numeric identifier
 * always lower than a non-numeric one, more fields wins when all prior equal).
 * Build metadata (`+...`) is ignored, per spec. Throws on an invalid input.
 */
export function compareSemver(a: string, b: string): number {
  if (!isValidSemver(a)) {
    throw new Error("compareSemver: invalid semver '" + a + "'");
  }
  if (!isValidSemver(b)) {
    throw new Error("compareSemver: invalid semver '" + b + "'");
  }
  const parse = (v: string): { main: number[]; pre: string[] } => {
    const [core] = v.split('+', 1);
    const dashIdx = core.indexOf('-');
    const mainPart = dashIdx === -1 ? core : core.slice(0, dashIdx);
    const prePart = dashIdx === -1 ? '' : core.slice(dashIdx + 1);
    return {
      main: mainPart.split('.').map((n) => Number(n)),
      pre: prePart === '' ? [] : prePart.split('.'),
    };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa.main[i] !== pb.main[i]) {
      return pa.main[i] < pb.main[i] ? -1 : 1;
    }
  }
  // No pre-release outranks a pre-release of the same core version.
  if (pa.pre.length === 0 && pb.pre.length === 0) return 0;
  if (pa.pre.length === 0) return 1;
  if (pb.pre.length === 0) return -1;
  const len = Math.min(pa.pre.length, pb.pre.length);
  for (let i = 0; i < len; i++) {
    const ai = pa.pre[i];
    const bi = pb.pre[i];
    const aNum = /^\d+$/.test(ai);
    const bNum = /^\d+$/.test(bi);
    if (aNum && bNum) {
      const na = Number(ai);
      const nb = Number(bi);
      if (na !== nb) return na < nb ? -1 : 1;
    } else if (aNum !== bNum) {
      // Numeric identifiers always have lower precedence than non-numeric ones.
      return aNum ? -1 : 1;
    } else if (ai !== bi) {
      return ai < bi ? -1 : 1;
    }
  }
  if (pa.pre.length !== pb.pre.length) {
    return pa.pre.length < pb.pre.length ? -1 : 1;
  }
  return 0;
}

/** Stable `id@version` identity string used to surface a playbook's version. */
export function playbookVersionId(meta: Pick<PlaybookMeta, 'id' | 'version'>): string {
  return `${meta.id}@${meta.version}`;
}

/**
 * EFFECTIVE required scope of a playbook for gating (#5202). For a `composite`
 * playbook this is the MAX of its declared `requiredScope` and the scope of
 * every tool its steps call -- so a composite that mutates in any step requires
 * (at least) that mutating scope regardless of what it declared. For non-
 * composite playbooks (no steps) it is simply the declared `requiredScope`.
 */
export function effectiveRequiredScope(
  meta: Pick<PlaybookMeta, 'requiredScope' | 'steps'>
): ToolScope {
  const steps = meta.steps;
  if (!steps || steps.length === 0) {
    return meta.requiredScope;
  }
  return compositeRequiredScope(meta.requiredScope, steps.map((s) => s.tool));
}

/**
 * True when a playbook's sunset boundary has passed and it must no longer be
 * served. `sunsetAfter` is either an ISO date (past when `now` is later) or a
 * semver (past when the running `version` is >= the sunset version). An absent
 * or non-deprecated `sunsetAfter` never sunsets. `now` is injectable for tests.
 */
export function isPastSunset(meta: PlaybookMeta, now: Date = new Date()): boolean {
  const sunset = meta.sunsetAfter;
  if (typeof sunset !== 'string' || sunset.trim() === '') {
    return false;
  }
  if (isValidIsoDate(sunset)) {
    // Sunset at end of the given calendar day (exclusive after it).
    return now.getTime() > Date.parse(`${sunset}T23:59:59.999Z`);
  }
  if (isValidSemver(sunset)) {
    return compareSemver(meta.version, sunset) >= 0;
  }
  return false;
}

/**
 * Subscription tier ordering, lowest -> highest. Used by `availableForTier` for
 * #5196 gating. `minTier` values outside this list are treated as their own
 * highest rank (only an exact tier match satisfies them) so an unknown tier can
 * never accidentally widen visibility.
 */
export const TIER_ORDER: readonly string[] = ['free', 'starter', 'business', 'enterprise'];

function tierRank(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/** Directory this module lives in -- the default playbooks root (siblings). */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate a parsed `meta.json` object into a typed `PlaybookMeta`. Throws a
 * `PlaybookValidationError` (naming `file`) on the first violation.
 */
function validateMeta(raw: unknown, file: string): PlaybookMeta {
  if (!isPlainObject(raw)) {
    throw new PlaybookValidationError('meta.json must be a JSON object', file);
  }

  const requireString = (field: string): string => {
    const value = raw[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new PlaybookValidationError(`missing/empty required string field '${field}'`, file);
    }
    return value;
  };

  const id = requireString('id');
  const name = requireString('name');
  const version = requireString('version');
  const description = requireString('description');
  const minTier = requireString('minTier');

  if (!isValidSemver(version)) {
    throw new PlaybookValidationError("invalid semver version '" + version + "'", file);
  }

  const requiredScope = raw.requiredScope;
  if (!(FINE_SCOPES as readonly unknown[]).includes(requiredScope)) {
    throw new PlaybookValidationError(
      `invalid requiredScope '${stringifyUnknown(requiredScope)}' (expected one of ${FINE_SCOPES.join(', ')})`,
      file
    );
  }

  const delivery = raw.delivery;
  if (!(PLAYBOOK_DELIVERIES as readonly unknown[]).includes(delivery)) {
    throw new PlaybookValidationError(
      `invalid delivery '${String(delivery)}' (expected one of ${PLAYBOOK_DELIVERIES.join(', ')})`,
      file
    );
  }

  const tagsRaw = raw.tags ?? [];
  if (!Array.isArray(tagsRaw) || tagsRaw.some((t) => typeof t !== 'string')) {
    throw new PlaybookValidationError(`'tags' must be an array of strings`, file);
  }

  if (raw.inputs !== undefined && !isPlainObject(raw.inputs)) {
    throw new PlaybookValidationError(`'inputs' must be an object when present`, file);
  }
  if (raw.args !== undefined && !isPlainObject(raw.args)) {
    throw new PlaybookValidationError(`'args' must be an object when present`, file);
  }

  const steps = validateSteps(raw.steps, delivery as PlaybookDelivery, file);

  // READ XOR SEND (#5202): a composite must not UNDER-declare its requiredScope
  // relative to what its steps actually do. Fail loud at load if a composite's
  // declared scope is weaker than the max scope its step tools require -- so a
  // mutating composite can never be listed/run under a weaker (e.g. read) key by
  // mis-declaring its scope. This makes `meta.requiredScope` a trustworthy upper
  // bound that every downstream gate can safely rely on.
  if (steps !== undefined) {
    const effective = compositeRequiredScope(
      requiredScope as ToolScope,
      steps.map((s) => s.tool)
    );
    if (effective !== requiredScope) {
      throw new PlaybookValidationError(
        `composite playbook declares requiredScope '${String(requiredScope)}' but its ` +
          `steps require '${effective}' (a step calls a tool of that scope); declared ` +
          `scope must be >= the scope of every step's tool (read XOR send, #5202)`,
        file
      );
    }
  }

  const deprecation = validateDeprecation(raw, file);

  return {
    id,
    name,
    version,
    description,
    requiredScope: requiredScope as ToolScope,
    delivery: delivery as PlaybookDelivery,
    minTier,
    tags: tagsRaw as string[],
    ...(raw.inputs !== undefined ? { inputs: raw.inputs as Record<string, unknown> } : {}),
    ...(raw.args !== undefined ? { args: raw.args as Record<string, unknown> } : {}),
    ...(steps !== undefined ? { steps } : {}),
    ...deprecation,
  };
}

/**
 * Validate the optional deprecation contract (#5199). Enforces:
 *   - `deprecated`, when present, is a boolean.
 *   - `deprecatedSince` / `supersededBy` / `deprecationReason`, when present, are
 *     non-empty strings; `deprecatedSince` must be valid semver.
 *   - `sunsetAfter`, when present, is a non-empty string that is EITHER a valid
 *     ISO date (`YYYY-MM-DD`) OR a valid semver.
 *   - when `deprecated === true`, a migration path is REQUIRED: at least one of
 *     `supersededBy` or `deprecationReason` must be present (no silent breaking).
 *   - the deprecation-only fields must NOT appear unless `deprecated === true`,
 *     so a live playbook can never carry a stray sunset/superseded marker.
 */
function validateDeprecation(
  raw: Record<string, unknown>,
  file: string
): Partial<
  Pick<
    PlaybookMeta,
    'deprecated' | 'deprecatedSince' | 'deprecationReason' | 'supersededBy' | 'sunsetAfter'
  >
> {
  if (raw.deprecated !== undefined && typeof raw.deprecated !== 'boolean') {
    throw new PlaybookValidationError(`'deprecated' must be a boolean when present`, file);
  }
  const deprecated = raw.deprecated === true;

  const optionalString = (field: string): string | undefined => {
    const value = raw[field];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string' || value.trim() === '') {
      throw new PlaybookValidationError(`'${field}' must be a non-empty string when present`, file);
    }
    return value;
  };

  const deprecatedSince = optionalString('deprecatedSince');
  const deprecationReason = optionalString('deprecationReason');
  const supersededBy = optionalString('supersededBy');
  const sunsetAfter = optionalString('sunsetAfter');

  const markers = { deprecatedSince, deprecationReason, supersededBy, sunsetAfter };
  const hasMarker = Object.values(markers).some((v) => v !== undefined);

  if (!deprecated) {
    if (hasMarker) {
      throw new PlaybookValidationError(
        `deprecation fields (deprecatedSince/deprecationReason/supersededBy/sunsetAfter) ` +
          `require 'deprecated: true'`,
        file
      );
    }
    return {};
  }

  if (deprecatedSince !== undefined && !isValidSemver(deprecatedSince)) {
    throw new PlaybookValidationError(
      "invalid semver 'deprecatedSince' '" + deprecatedSince + "'",
      file
    );
  }
  if (sunsetAfter !== undefined && !(isValidIsoDate(sunsetAfter) || isValidSemver(sunsetAfter))) {
    throw new PlaybookValidationError(
      "'sunsetAfter' must be an ISO date (YYYY-MM-DD) or a semver (got '" + sunsetAfter + "')",
      file
    );
  }
  if (supersededBy === undefined && deprecationReason === undefined) {
    throw new PlaybookValidationError(
      `deprecated playbook requires a migration path: set 'supersededBy' and/or ` +
        `'deprecationReason' (no silent breaking)`,
      file
    );
  }

  return {
    deprecated: true,
    ...(deprecatedSince !== undefined ? { deprecatedSince } : {}),
    ...(deprecationReason !== undefined ? { deprecationReason } : {}),
    ...(supersededBy !== undefined ? { supersededBy } : {}),
    ...(sunsetAfter !== undefined ? { sunsetAfter } : {}),
  };
}

/**
 * Validate a composite playbook's `steps` program (#5197). A `composite`
 * playbook MUST declare a non-empty ordered `steps` array; every other delivery
 * mode MUST NOT declare `steps`. Each step needs a non-empty string `id`
 * (unique within the playbook) and a non-empty string `tool`; `args` is an
 * optional object. Throws `PlaybookValidationError` (naming `file`) on the first
 * violation, matching the fail-loud contract of the rest of the registry.
 */
function validateSteps(
  raw: unknown,
  delivery: PlaybookDelivery,
  file: string
): PlaybookStep[] | undefined {
  if (delivery !== 'composite') {
    if (raw !== undefined) {
      throw new PlaybookValidationError(
        `'steps' is only valid for delivery 'composite' (got delivery '${delivery}')`,
        file
      );
    }
    return undefined;
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new PlaybookValidationError(
      `composite playbook requires a non-empty 'steps' array`,
      file
    );
  }

  const seen = new Set<string>();
  const steps: PlaybookStep[] = raw.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new PlaybookValidationError(`step[${index}] must be an object`, file);
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.trim() === '') {
      throw new PlaybookValidationError(
        `step[${index}] missing/empty required string field 'id'`,
        file
      );
    }
    if (seen.has(id)) {
      throw new PlaybookValidationError(`duplicate step id '${id}'`, file);
    }
    seen.add(id);

    const tool = entry.tool;
    if (typeof tool !== 'string' || tool.trim() === '') {
      throw new PlaybookValidationError(
        `step '${id}' missing/empty required string field 'tool'`,
        file
      );
    }

    if (entry.args !== undefined && !isPlainObject(entry.args)) {
      throw new PlaybookValidationError(`step '${id}' field 'args' must be an object`, file);
    }

    return {
      id,
      tool,
      ...(entry.args !== undefined ? { args: entry.args as Record<string, unknown> } : {}),
    };
  });

  assertContentProvenance(steps, file);

  return steps;
}

/**
 * Content-arg keys of a `send` step whose VALUE is delivered verbatim to a
 * recipient (message body, subject, ...). Templating a `read` step's output
 * into one of these is the data-exfiltration / prompt-injection surface the
 * provenance contract forbids (issue #5412). Recipient-TARGET keys (`to`,
 * `recipient`, `contactId`, `phone`, ...) are deliberately NOT here: a
 * read-contacts -> send-to-each flow (e.g. reengage-inactive) is legitimate.
 */
const SEND_CONTENT_ARG_KEYS = new Set([
  'message',
  'text',
  'body',
  'content',
  'caption',
  'subject',
  'html',
  'note',
  'comment',
]);

const STEP_TEMPLATE_REF = /\{\{\s*steps\.([A-Za-z0-9_-]+)\.[^}]*\}\}/g;

/**
 * Content-provenance contract (#5412): a `send`-scoped step MUST NOT template a
 * `read`-scoped step's output into a delivered-content arg. Read output can be
 * attacker-controlled (a contact's own message text, external content); letting
 * it flow unfiltered into a send body turns a composite into an exfil / echo
 * primitive. Enforced statically at load so no such playbook can ship -- composite
 * programs come only from the trusted registry, never from LLM/user input, so the
 * static gate is the full boundary. Throws `PlaybookValidationError` on violation.
 */
function assertContentProvenance(steps: PlaybookStep[], file: string): void {
  const scopeById = new Map<string, ToolScope>(
    steps.map((s) => [s.id, resolveToolScope({ name: s.tool })])
  );

  for (const step of steps) {
    if (resolveToolScope({ name: step.tool }) !== 'send' || !step.args) continue;
    for (const [key, value] of Object.entries(step.args)) {
      if (!SEND_CONTENT_ARG_KEYS.has(key.toLowerCase())) continue;
      for (const refId of collectStepRefs(value)) {
        if (scopeById.get(refId) === 'read') {
          throw new PlaybookValidationError(
            `content-provenance violation: send step '${step.id}' templates read ` +
              `step '${refId}' output into content arg '${key}'. Read output must ` +
              `not flow into delivered content (exfil/injection guard, #5412).`,
            file
          );
        }
      }
    }
  }
}

/** Collect all `{{steps.<id>...}}` step ids referenced anywhere in a value tree. */
function collectStepRefs(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    for (const m of value.matchAll(STEP_TEMPLATE_REF)) acc.add(m[1]);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStepRefs(v, acc);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectStepRefs(v, acc);
  }
  return acc;
}

/**
 * Load and validate a single playbook directory. Throws
 * `PlaybookValidationError` if `meta.json`/`skill.md` are missing, empty, or
 * malformed.
 */
export function loadPlaybookDir(dir: string): Playbook {
  const metaPath = join(dir, 'meta.json');
  const skillPath = join(dir, 'skill.md');

  if (!existsSync(metaPath)) {
    throw new PlaybookValidationError('missing meta.json', dir);
  }
  if (!existsSync(skillPath)) {
    throw new PlaybookValidationError('missing skill.md', dir);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch (err) {
    throw new PlaybookValidationError(
      `meta.json is not valid JSON: ${(err as Error).message}`,
      metaPath
    );
  }

  const meta = validateMeta(parsed, metaPath);

  const skill = readFileSync(skillPath, 'utf-8').replace(/\s+$/, '');
  if (skill.trim() === '') {
    throw new PlaybookValidationError('skill.md is empty', skillPath);
  }

  return { meta, skill, dir };
}

/**
 * The playbook registry: an fs-discovered, validated, cached catalog with
 * lookup + filtering helpers.
 */
export class PlaybookRegistry {
  private readonly root: string;
  private cache: Map<string, Playbook> | null = null;

  /**
   * @param root Directory holding `<id>/{skill.md,meta.json}` subdirectories.
   *   Defaults to this module's own directory (the shipped `src/playbooks/`).
   */
  constructor(root: string = MODULE_DIR) {
    this.root = root;
  }

  /**
   * Scan + validate all playbooks, populating the cache. Idempotent: returns
   * the cached set on subsequent calls until `reload()` is invoked. Throws
   * `PlaybookValidationError` (naming the file) on the first invalid playbook,
   * or a plain `Error` on a duplicate id.
   */
  load(): Map<string, Playbook> {
    if (this.cache) {
      return this.cache;
    }

    const result = new Map<string, Playbook>();

    if (!existsSync(this.root)) {
      this.cache = result;
      return result;
    }

    const entries = readdirSync(this.root).sort();
    for (const entry of entries) {
      const dir = join(this.root, entry);
      if (!statSync(dir).isDirectory()) {
        continue;
      }
      // A directory is a playbook candidate only if it carries a meta.json.
      // Other subdirectories (e.g. shared assets) are skipped silently.
      if (!existsSync(join(dir, 'meta.json'))) {
        continue;
      }

      const playbook = loadPlaybookDir(dir);

      if (result.has(playbook.meta.id)) {
        const existing = result.get(playbook.meta.id)!;
        throw new PlaybookValidationError(
          `duplicate playbook id '${playbook.meta.id}' (already loaded from ${existing.dir})`,
          dir
        );
      }
      result.set(playbook.meta.id, playbook);
    }

    this.cache = result;
    return result;
  }

  /** Drop the cache and re-scan on the next access. Returns the fresh set. */
  reload(): Map<string, Playbook> {
    this.cache = null;
    return this.load();
  }

  /** All playbooks, sorted by id. */
  list(): Playbook[] {
    return [...this.load().values()].sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  }

  /** Look up a single playbook by id, or `undefined`. */
  get(id: string): Playbook | undefined {
    return this.load().get(id);
  }

  /** True when a playbook with `id` exists. */
  has(id: string): boolean {
    return this.load().has(id);
  }

  /** Playbooks whose delivery mode matches (`prompt` for #5196, `composite` for #5197). */
  listByDelivery(delivery: PlaybookDelivery): Playbook[] {
    return this.list().filter((p) => p.meta.delivery === delivery);
  }

  /** Playbooks whose `requiredScope` equals `scope` exactly. */
  listByScope(scope: ToolScope): Playbook[] {
    return this.list().filter((p) => p.meta.requiredScope === scope);
  }

  /**
   * Playbooks a key holding `scopes` is allowed to run -- reuses the #5192
   * scope-hierarchy semantics (`isToolAllowedForScopes`). A key with no fine
   * scope is unrestricted and gets every playbook.
   *
   * READ XOR SEND (#5202): a composite is gated by its EFFECTIVE scope (max of
   * declared `requiredScope` and every step tool's scope, see
   * `effectiveRequiredScope`), not merely its declared scope -- so a composite
   * that mutates in any step is never visible/runnable under a read-only key even
   * if it mis-declared. (Load-time validation already rejects such a mis-declared
   * composite; this is the redundant runtime gate.)
   */
  listAllowedForScopes(scopes: string[] | undefined): Playbook[] {
    return this.list().filter((p) =>
      isToolAllowedForScopes(
        { name: p.meta.id, requiredScope: effectiveRequiredScope(p.meta) },
        scopes
      )
    );
  }

  /** Playbooks whose `minTier` equals `tier` exactly. */
  listByMinTier(tier: string): Playbook[] {
    return this.list().filter((p) => p.meta.minTier === tier);
  }

  /**
   * Playbooks available to a subscriber on `tier` -- i.e. `minTier` rank <=
   * `tier` rank per `TIER_ORDER`. Unknown tiers only match themselves. This is
   * the tier gate #5196 will apply for visibility.
   */
  availableForTier(tier: string): Playbook[] {
    const have = tierRank(tier);
    return this.list().filter((p) => tierRank(p.meta.minTier) <= have);
  }
}

/** Shared default registry over the shipped `src/playbooks/` directory. */
export const playbookRegistry = new PlaybookRegistry();

// Re-export the scope helper types callers commonly need alongside the registry.
export { grantedScopeLevel };
export type { ToolScope };
