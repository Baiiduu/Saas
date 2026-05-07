import { formatDate, formatRelativeTime, formatFileSize, truncateText, formatPercentage, pluralize } from '../format';

describe('formatDate', () => {
  it('should format a date string with default format (full datetime)', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    // Should contain date parts (zh-CN format: YYYY/MM/DD HH:MM:SS)
    expect(result).toContain('2024');
    expect(result).toContain('01');
    expect(result).toContain('15');
    // Should contain time parts (hour may vary by timezone)
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('should use zh-CN locale (YYYY/MM/DD date format)', () => {
    // zh-CN format uses YYYY/MM/DD, not MM/DD/YYYY (en) or DD/MM/YYYY (fr)
    const result = formatDate('2024-01-15T10:30:00Z', 'date');
    expect(result).toBe('2024/01/15');
  });

  it('should format a Date object with default format', () => {
    const date = new Date('2024-06-20T14:45:00Z');
    const result = formatDate(date);
    expect(result).toContain('2024');
    expect(result).toContain('06');
    expect(result).toContain('20');
  });

  it('should format with "date" format (no time)', () => {
    const result = formatDate('2024-01-15T10:30:00Z', 'date');
    expect(result).toContain('2024');
    expect(result).toContain('01');
    expect(result).toContain('15');
    // Should not contain colons (time separator)
    expect(result).not.toMatch(/\d{2}:\d{2}/);
  });

  it('should format with "datetime" format (date + hours + minutes, no seconds)', () => {
    const result = formatDate('2024-01-15T10:30:00Z', 'datetime');
    expect(result).toContain('2024');
    // Should match pattern like YYYY/MM/DD HH:MM (no seconds)
    expect(result).toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/);
    expect(result).not.toMatch(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
  });

  it('should format with "time" format (hours + minutes + seconds, no date)', () => {
    const result = formatDate('2024-01-15T10:30:45Z', 'time');
    // Should match pattern like HH:MM:SS
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    // Should not contain date separators
    expect(result).not.toContain('/');
  });

  it('should handle invalid date string by throwing or returning Invalid Date', () => {
    // Intl.DateTimeFormat.format() on Invalid Date throws RangeError
    expect(() => formatDate('not-a-date')).toThrow();
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-07-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return "刚刚" for times less than 1 minute ago', () => {
    const date = new Date('2024-07-01T11:59:45Z');
    expect(formatRelativeTime(date)).toBe('刚刚');
  });

  it('should return minutes for times less than 1 hour ago', () => {
    const date = new Date('2024-07-01T11:30:00Z');
    expect(formatRelativeTime(date)).toBe('30 分钟前');
  });

  it('should return hours for times less than 24 hours ago', () => {
    const date = new Date('2024-07-01T08:00:00Z');
    expect(formatRelativeTime(date)).toBe('4 小时前');
  });

  it('should return days for times less than 7 days ago', () => {
    const date = new Date('2024-06-28T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('3 天前');
  });

  it('should return weeks for times less than 4 weeks ago', () => {
    const date = new Date('2024-06-10T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('3 周前');
  });

  it('should return months for times less than 12 months ago', () => {
    const date = new Date('2024-02-01T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('5 个月前');
  });

  it('should return formatted date for times 12+ months ago', () => {
    const date = new Date('2022-07-01T12:00:00Z');
    const result = formatRelativeTime(date);
    expect(result).toContain('2022');
    expect(result).toContain('07');
    expect(result).toContain('01');
  });

  it('should handle string date input', () => {
    expect(formatRelativeTime('2024-07-01T11:59:45Z')).toBe('刚刚');
  });
});

describe('formatFileSize', () => {
  it('should return "0 B" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('should format MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('should format GB', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });

  it('should format large values with decimal places', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });
});

describe('truncateText', () => {
  it('should return the original text if shorter than maxLength', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('should return the original text if equal to maxLength', () => {
    expect(truncateText('hello', 5)).toBe('hello');
  });

  it('should truncate and add ellipsis if longer than maxLength', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });

  it('should handle empty string', () => {
    expect(truncateText('', 5)).toBe('');
  });
});

describe('formatPercentage', () => {
  it('should format 0 as "0.0%"', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('should format 1 as "100.0%"', () => {
    expect(formatPercentage(1)).toBe('100.0%');
  });

  it('should format 0.256 as "25.6%"', () => {
    expect(formatPercentage(0.256)).toBe('25.6%');
  });

  it('should format 0.3333 as "33.3%"', () => {
    expect(formatPercentage(0.3333)).toBe('33.3%');
  });
});

describe('pluralize', () => {
  it('should return singular for count === 1', () => {
    expect(pluralize(1, 'item')).toBe('item');
  });

  it('should return plural with "s" for count !== 1 when no plural provided', () => {
    expect(pluralize(0, 'item')).toBe('items');
    expect(pluralize(2, 'item')).toBe('items');
    expect(pluralize(100, 'item')).toBe('items');
  });

  it('should use custom plural form when provided', () => {
    expect(pluralize(2, 'child', 'children')).toBe('children');
    expect(pluralize(1, 'child', 'children')).toBe('child');
  });
});
