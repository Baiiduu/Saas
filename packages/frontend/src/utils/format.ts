const DEFAULT_LOCALE = 'zh-CN';

/**
 * Format a date to a localized string.
 * Uses Intl.DateTimeFormat for consistent formatting.
 */
export function formatDate(
  date: string | Date,
  format?: string
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'date') {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  if (format === 'datetime') {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  if (format === 'time') {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  }

  // Default: full datetime with seconds
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

/**
 * Format a date to a relative time string like "2 hours ago" or "3 days ago".
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return '刚刚';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }
  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }
  if (diffWeeks < 4) {
    return `${diffWeeks} 周前`;
  }
  if (diffMonths < 12) {
    return `${diffMonths} 个月前`;
  }

  return formatDate(d, 'date');
}

/**
 * Format file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const base = 1024;
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
  const clampedIndex = Math.min(unitIndex, units.length - 1);
  const value = bytes / Math.pow(base, clampedIndex);

  return `${value.toFixed(clampedIndex === 0 ? 0 : 1)} ${units[clampedIndex]}`;
}

/**
 * Truncate text with ellipsis if it exceeds maxLength.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format a number as a percentage string.
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Simple pluralization helper.
 * Returns singular form if count is 1, plural form otherwise.
 * If plural is not provided, appends 's' to the singular form.
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  if (count === 1) return singular;
  return plural ?? `${singular}s`;
}
