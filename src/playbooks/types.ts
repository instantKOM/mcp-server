/**
 * Playbook format types (Agent-Connect EPIC 2, issue #5195).
 *
 * A "playbook" is an authored, versioned agent recipe shipped as DATA -- a
 * directory containing:
 *   - `skill.md`   the human-authored prompt / instructions body.
 *   - `meta.json`  structured metadata (this file's `PlaybookMeta`).
 *
 * Downstream issues consume this foundation:
 *   #5196 serves playbooks via prompts/list + tools/list (uses `delivery`,
 *         `minTier`, `requiredScope` for gating/visibility).
 *   #5197 runs `delivery: 'composite'` playbooks server-side.
 *   #5199 adds the semver deprecation policy on top of `version`.
 *
 * This module only defines the FORMAT + REGISTRY + validation + lookup. No
 * serving, no execution.
 */

import type { ToolScope } from '../tools/tool-scopes.js';

/**
 * How a playbook is delivered to / executed for the caller.
 *   - `prompt`    client-side: the skill body is handed to the model as a
 *                 prompt (served via prompts/list in #5196).
 *   - `composite` server-side: the MCP server orchestrates a multi-tool
 *                 sequence (executed in #5197).
 */
export type PlaybookDelivery = 'prompt' | 'composite';

export const PLAYBOOK_DELIVERIES: readonly PlaybookDelivery[] = ['prompt', 'composite'];

/**
 * A single machine-executable step of a `composite` playbook (#5197). Each step
 * invokes ONE existing MCP tool by name with `args` templated from the
 * playbook's inputs and prior step outputs.
 *
 * Template syntax inside any string `args` value:
 *   - `{{inputs.<key>}}`            -> the playbook input value.
 *   - `{{steps.<stepId>.<path>}}`   -> a (dotted) field of a prior step's parsed
 *                                      output (JSON-parsed tool response).
 * A value that is EXACTLY a single `{{...}}` placeholder keeps the referenced
 * value's native type (number/array/object); a placeholder embedded in a larger
 * string is stringified.
 */
export interface PlaybookStep {
  /** Unique (within the playbook) identifier used to reference this step's output. */
  id: string;
  /** Name of an existing MCP tool this step calls. */
  tool: string;
  /** Templated arguments passed to the tool (see `PlaybookStep` doc). */
  args?: Record<string, unknown>;
}

/**
 * Structured metadata for a playbook (`meta.json`). Additive fields (`inputs`,
 * `args`) are reserved for later issues and validated only shallowly here.
 */
export interface PlaybookMeta {
  /** Stable unique identifier (kebab-case recommended), e.g. `reactivate-inactive`. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Semantic version, e.g. `1.0.0` (validated against the semver 2.0.0 grammar). */
  version: string;
  /** One-line description of what the playbook does. */
  description: string;
  /**
   * Minimum tool-scope the caller's key must grant to run this playbook.
   * Reuses the #5192 `read | draft | send` semantics.
   */
  requiredScope: ToolScope;
  /** Delivery mode (see `PlaybookDelivery`). */
  delivery: PlaybookDelivery;
  /**
   * Minimum subscription tier required to see/run this playbook (e.g.
   * `business`). Free-form here; #5196 does the actual gating.
   */
  minTier: string;
  /** Free-form classification tags. */
  tags: string[];
  /** Optional input/argument schema for later issues (opaque here). */
  inputs?: Record<string, unknown>;
  /** Optional argument descriptor for later issues (opaque here). */
  args?: Record<string, unknown>;
  /**
   * Deprecation contract (#5199). A deprecated playbook is still LISTED (marked)
   * until its sunset passes -- never a silent breaking removal. When `deprecated`
   * is `true`, the registry REQUIRES a migration path: at least one of
   * `supersededBy` (id of the replacement playbook) or `deprecationReason` (why
   * it is going away) must be present. See `src/playbooks/VERSIONING.md`.
   */
  deprecated?: boolean;
  /** Semver at which the playbook became deprecated (validated when present). */
  deprecatedSince?: string;
  /** Human-readable reason the playbook is deprecated. */
  deprecationReason?: string;
  /** Id of the playbook that supersedes this one (the migration target). */
  supersededBy?: string;
  /**
   * Sunset boundary after which the playbook stops being served. Either an ISO
   * calendar date (`YYYY-MM-DD`) or a semver. Once passed (date < now, or the
   * running playbook `version` >= the sunset version), serving EXCLUDES it.
   */
  sunsetAfter?: string;
  /**
   * Ordered step program for a `composite` playbook (#5197). REQUIRED and
   * non-empty when `delivery === 'composite'`; MUST be absent otherwise. Each
   * step calls one existing MCP tool with templated args (see `PlaybookStep`).
   */
  steps?: PlaybookStep[];
}

/** A fully loaded + validated playbook. */
export interface Playbook {
  /** Parsed + validated metadata. */
  meta: PlaybookMeta;
  /** The `skill.md` body (non-empty, trimmed of trailing whitespace only). */
  skill: string;
  /** Absolute path of the playbook directory it was loaded from. */
  dir: string;
}

/**
 * Thrown when a playbook fails validation at load time. Always carries the
 * offending file/dir so a broken playbook can never silently vanish.
 */
export class PlaybookValidationError extends Error {
  constructor(
    message: string,
    /** Absolute path of the offending file or directory. */
    public readonly file: string
  ) {
    super(`${message} (in ${file})`);
    this.name = 'PlaybookValidationError';
  }
}
