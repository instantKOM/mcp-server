// AUTO-GENERATED FILE - DO NOT EDIT.
// Source of truth: packages/sentry-privacy/src/sentry-privacy.ts
// Regenerate: node packages/sentry-privacy/scripts/sync.mjs

/**
 * Sentry URL privacy for the API, the MCP-Server and the frontend (#7667,
 * #7703, #7722). The browser loader (sentry-on-load.js) and PHP
 * (Sentry::redactUrl) implement the same contract,
 * packages/sentry-privacy/conformance.v1.json.
 */

export const REDACTED = '[REDACTED]';

// Request headers that carry no credentials or message content.
const REQUEST_HEADER_ALLOWLIST = new Set([
  'host',
  'user-agent',
  'accept',
  'content-type',
  'content-length',
]);

// Breadcrumb and span data fields the SDK fills with the raw query or
// fragment (@sentry/core integrations/http/add-outgoing-request-breadcrumb.js,
// fetch.js, utils/url.js).
const QUERY_DATA_KEYS = new Set([
  'http.query',
  'http.fragment',
  'url.query',
  'url.fragment',
]);

// Data fields that carry a whole URL, a path or a request target: fetch/xhr
// breadcrumbs keep the full URL, navigation breadcrumbs from/to, HTTP and
// pageload spans url.path (@sentry/core utils/url.js).
const URL_DATA_KEYS = new Set([
  'url',
  'http.url',
  'url.full',
  'url.path',
  'http.target',
  'from',
  'to',
  'lcp.url',
  'browser.web_vital.lcp.url',
]);

// Span ops whose description is a URL or a URL path: HTTP and resource
// spans keep the query, pageload and navigation roots are named by the path.
const URL_DESCRIPTION_OPS =
  /^(?:(?:http|resource|navigation)\.|(?:pageload|navigation)$)/;

// Routes whose next path segment is a credential: the token routes of
// FrontendRoutes.php and the API routes behind them
// (auth/verify-email/:token, auth/password-reset/validate/:token,
// v1/mail-unsubscribe/:token), and the FCM device token the mobile app
// deletes through app/push/devices/:token.
const TOKEN_ROUTE =
  /(\/(?:password-reset|verify-email|verify-email-change|mail-unsubscribe|push\/devices)\/(?:validate\/)?)([^/\s]+)/gi;

// Route patterns (:token, [token], %5Btoken%5D), a redacted segment and the
// literal validate and heartbeat steps are no credential.
const ROUTE_PLACEHOLDER = /^(?::\w+|\[[^\]]*\]|%5B.*%5D|validate|heartbeat)$/i;

const TELEGRAM_BOT_TOKEN = /(\/bot)\d+:[\w-]+(?=\/|\s|$)/g;

const USERINFO = /([a-z][a-z0-9+.-]*:\/\/)[^/\s@]*@/gi;

/**
 * Redacts a URL, a request target or a "METHOD url" description.
 *
 * Query and fragment leave entirely (#7703); a parameter denylist misses
 * every name nobody listed. Userinfo is dropped. Path segments that carry a
 * credential become [REDACTED] (#7722): password reset, email verification
 * and unsubscribe links put their token into the path, where query
 * stripping and replay text masking never reach it.
 */
export function redactSentryUrl(url: string): string {
  return url
    .split(/[?#]/, 1)[0]
    .replace(USERINFO, '$1')
    .replace(TELEGRAM_BOT_TOKEN, `$1${REDACTED}`)
    .replace(TOKEN_ROUTE, (match: string, route: string, segment: string) =>
      ROUTE_PLACEHOLDER.test(segment) ? match : `${route}${REDACTED}`,
    );
}

/**
 * Breadcrumb and span hook: URL data fields, URL span descriptions and the
 * transaction name lose query, fragment and path tokens. The SDK cuts the
 * query off the breadcrumb URL and the span name only to record it next to
 * them as http.query / url.query; the browser SDK names transactions after
 * location.pathname until a route is known.
 */
export function redactSentryUrls<T>(item: T): T {
  if (!isRecord(item)) return item;
  const redacted: Record<string, unknown> = { ...item };

  if (isRecord(item.data)) {
    redacted.data = redactUrlData(item.data, URL_DATA_KEYS);
  }
  if (
    typeof item.op === 'string' &&
    URL_DESCRIPTION_OPS.test(item.op) &&
    typeof item.description === 'string'
  ) {
    redacted.description = redactSentryUrl(item.description);
  }
  if (typeof item.transaction === 'string') {
    redacted.transaction = redactSentryUrl(item.transaction);
  }

  return redacted as T;
}

/**
 * Event and transaction hook: redactSentryUrls() plus the request rebuilt
 * from an allowlist (#7667). The SDKs attach the body (httpIntegration
 * maxRequestBodySize defaults to "medium"), the query string, cookies and
 * every header; the browser SDK sends location.href.
 */
export function redactSentryPayload<T>(payload: T): T {
  if (!isRecord(payload) || !isRecord(payload.request)) {
    return redactSentryUrls(payload);
  }
  const reduced: Record<string, unknown> = {
    ...payload,
    request: reduceRequest(payload.request),
  };

  return redactSentryUrls(reduced) as T;
}

// rrweb EventType.Meta and EventType.Custom.
const RRWEB_META = 4;
const RRWEB_CUSTOM = 5;

// Replay performance span ops whose description is a URL.
const REPLAY_URL_OPS = /^(?:navigation|resource)\./;

// navigation.push spans keep the previous URL next to the description.
const REPLAY_URL_DATA_KEYS = new Set([...URL_DATA_KEYS, 'previous']);

/**
 * Recording event filter for Session Replay (#7722). Text masking keeps page
 * text out of the DOM snapshots, but the recording carries URLs of its own:
 * the rrweb meta event (href), performance spans for navigations and
 * resources, and the breadcrumbs it mirrors. Runs as beforeAddRecordingEvent
 * (custom events only) and as rrweb plugin (see withReplayUrlPrivacy()).
 */
export function redactSentryReplayRecordingEvent<T>(event: T): T {
  if (
    !isRecord(event) ||
    !isRecord(event.data) ||
    (event.type !== RRWEB_META && event.type !== RRWEB_CUSTOM)
  ) {
    return event;
  }
  const data: Record<string, unknown> = { ...event.data };

  if (event.type === RRWEB_META && typeof data.href === 'string') {
    data.href = redactSentryUrl(data.href);
  } else if (event.type === RRWEB_CUSTOM && isRecord(data.payload)) {
    if (data.tag === 'performanceSpan') {
      data.payload = redactPerformanceSpan(data.payload);
    } else if (data.tag === 'breadcrumb') {
      data.payload = redactSentryUrls(data.payload);
    }
  }
  const redacted: Record<string, unknown> = { ...event, data };

  return redacted as T;
}

/**
 * Puts redactSentryReplayRecordingEvent() in front of the rrweb meta event
 * (#7722). @sentry/replay applies beforeAddRecordingEvent to custom events
 * only (maybeApplyCallback/isCustomEvent), so the meta event would keep
 * location.href. rrweb runs plugins[].eventProcessor on every event it
 * emits, and the integration passes its _recordingOptions object to
 * record(). Without that object (another SDK version) replay is replaced by
 * an inert integration instead of recording raw URLs.
 */
export function withReplayUrlPrivacy<T extends object>(
  replay: T,
): T | { name: string } {
  const options = (replay as { _recordingOptions?: unknown })._recordingOptions;
  if (!isRecord(options)) return { name: 'Replay' };
  const plugins = Array.isArray(options.plugins) ? options.plugins : [];
  options.plugins = [
    ...plugins,
    {
      name: 'sentry-url-privacy',
      eventProcessor: redactSentryReplayRecordingEvent,
    },
  ];

  return replay;
}

/**
 * Browser integration for the replay_event (#7722). It skips beforeSend,
 * but runs through integration processEvent hooks after
 * httpContextIntegration set request.url to location.href; urls lists
 * every page the session visited.
 */
export function sentryUrlPrivacyIntegration() {
  return {
    name: 'SentryUrlPrivacy',
    processEvent: redactSentryReplayEvent,
  };
}

function redactSentryReplayEvent<T>(event: T): T {
  if (!isRecord(event) || event.type !== 'replay_event') return event;
  const redacted: Record<string, unknown> = { ...event };
  if (Array.isArray(event.urls)) {
    redacted.urls = event.urls.map((url: unknown) =>
      typeof url === 'string' ? redactSentryUrl(url) : url,
    );
  }

  return redactSentryPayload(redacted) as T;
}

function redactPerformanceSpan(
  span: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = { ...span };
  if (
    typeof span.op === 'string' &&
    REPLAY_URL_OPS.test(span.op) &&
    typeof span.description === 'string'
  ) {
    redacted.description = redactSentryUrl(span.description);
  }
  if (isRecord(span.data)) {
    redacted.data = redactUrlData(span.data, REPLAY_URL_DATA_KEYS);
  }

  return redacted;
}

function redactUrlData(
  data: Record<string, unknown>,
  urlKeys: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !QUERY_DATA_KEYS.has(key))
      .map(([key, value]) => [
        key,
        urlKeys.has(key) && typeof value === 'string'
          ? redactSentryUrl(value)
          : value,
      ]),
  );
}

// URL without query, fragment and path tokens, method, body and query as a
// field count only (the rule of the PHP LogScrubber::requestMetadata()),
// headers outside the allowlist masked, cookies dropped.
function reduceRequest(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const reduced: Record<string, unknown> = {};
  if (typeof source.url === 'string') reduced.url = redactSentryUrl(source.url);
  if (typeof source.method === 'string') reduced.method = source.method;
  if (isPresent(source.query_string)) {
    reduced.query_string = countFields(source.query_string);
  }
  if (isPresent(source.data)) reduced.data = countFields(source.data);
  if (isRecord(source.headers)) {
    reduced.headers = Object.fromEntries(
      Object.entries(source.headers).map(([name, value]) => [
        name,
        REQUEST_HEADER_ALLOWLIST.has(name.toLowerCase()) ? value : REDACTED,
      ]),
    );
  }

  return reduced;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function countFields(value: unknown): { field_count: number } {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return { field_count: Object.keys(parsed).length };
      }
    } catch {
      // Not JSON: count it as form or query fields below.
    }
    return { field_count: [...new URLSearchParams(value).keys()].length };
  }
  if (value && typeof value === 'object') {
    return { field_count: Object.keys(value).length };
  }
  return { field_count: 1 };
}
