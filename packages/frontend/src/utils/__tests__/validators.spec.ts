import { isValidEmail, isValidPhone, isValidPassword, isRequired, isValidUrl } from '../validators';

describe('isValidEmail', () => {
  it('should return true for a valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user@domain.co')).toBe(true);
    expect(isValidEmail('name+tag@company.org')).toBe(true);
  });

  it('should return false for an email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('should return false for an email without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should return false for an email without TLD', () => {
    expect(isValidEmail('user@domain')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('should return false for a string with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('should return true for Chinese mobile numbers', () => {
    expect(isValidPhone('13800138000')).toBe(true);
  });

  it('should return true for international format with + prefix', () => {
    expect(isValidPhone('+8613800138000')).toBe(true);
  });

  it('should return true for international format with dash', () => {
    expect(isValidPhone('+86-13800138000')).toBe(true);
  });

  it('should return true for shorter phone numbers', () => {
    expect(isValidPhone('1234567')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });

  it('should return false for too-short numbers (less than 7 digits)', () => {
    expect(isValidPhone('12345')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('should return valid for a strong password', () => {
    const result = isValidPassword('Password1');
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('should return invalid for password shorter than 8 characters', () => {
    const result = isValidPassword('Pa1');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('密码长度至少为 8 个字符');
  });

  it('should return invalid for password without uppercase', () => {
    const result = isValidPassword('password1');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('密码必须包含至少一个大写字母');
  });

  it('should return invalid for password without lowercase', () => {
    const result = isValidPassword('PASSWORD1');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('密码必须包含至少一个小写字母');
  });

  it('should return invalid for password without number', () => {
    const result = isValidPassword('Password');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('密码必须包含至少一个数字');
  });

  it('should return invalid for empty string', () => {
    const result = isValidPassword('');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('密码长度至少为 8 个字符');
  });
});

describe('isRequired', () => {
  it('should return true for a non-empty string', () => {
    expect(isRequired('hello')).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(isRequired('')).toBe(false);
  });

  it('should return false for a whitespace-only string', () => {
    expect(isRequired('   ')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isRequired(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isRequired(undefined)).toBe(false);
  });

  it('should return true for a non-empty array', () => {
    expect(isRequired([1, 2, 3])).toBe(true);
  });

  it('should return false for an empty array', () => {
    expect(isRequired([])).toBe(false);
  });

  it('should return true for a non-empty object', () => {
    expect(isRequired({ key: 'value' })).toBe(true);
  });

  it('should return false for an empty object', () => {
    expect(isRequired({})).toBe(false);
  });

  it('should return true for numbers', () => {
    expect(isRequired(0)).toBe(true);
    expect(isRequired(42)).toBe(true);
  });

  it('should return true for boolean values', () => {
    expect(isRequired(false)).toBe(true);
    expect(isRequired(true)).toBe(true);
  });
});

describe('isValidUrl', () => {
  it('should return true for a valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('should return true for a valid https URL', () => {
    expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
  });

  it('should return true for a URL with port', () => {
    expect(isValidUrl('https://localhost:3000/api')).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('should return false for a plain string without protocol', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('should return false for a malformed URL', () => {
    expect(isValidUrl('http://')).toBe(false);
  });
});
