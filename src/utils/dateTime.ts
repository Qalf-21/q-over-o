const HAS_TIMEZONE_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export const normalizeUtcTimestamp = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return HAS_TIMEZONE_OFFSET.test(trimmed) ? trimmed : `${trimmed}Z`;
};

export const parseUtcDate = (value: string | Date) =>
  value instanceof Date ? new Date(value) : new Date(normalizeUtcTimestamp(value));

export const toUtcISOString = (value: string | Date) => parseUtcDate(value).toISOString();

export const localDateKey = (value: string | Date) => {
  const date = parseUtcDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
