const HAS_TIMEZONE_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const normalizeUtcTimestamp = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  return HAS_TIMEZONE_OFFSET.test(trimmed) ? trimmed : `${trimmed}Z`;
};

const parseUtcDate = (value) => new Date(normalizeUtcTimestamp(value));

const toUtcISOString = (value) => parseUtcDate(value).toISOString();

module.exports = {
  normalizeUtcTimestamp,
  parseUtcDate,
  toUtcISOString,
};
