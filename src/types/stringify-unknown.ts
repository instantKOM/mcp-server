export function stringifyUnknown(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  if (value instanceof Error) return value.message;

  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'bigint':
    case 'boolean':
      return String(value);
    default:
      return JSON.stringify(value) ?? fallback;
  }
}
