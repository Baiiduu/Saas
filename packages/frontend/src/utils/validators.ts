/**
 * Validate an email address using a basic regex pattern.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate a phone number (supports Chinese mobile numbers and general formats).
 */
export function isValidPhone(phone: string): boolean {
  // Supports: Chinese mobile numbers (11 digits starting with 1)
  // and general international formats like +86-13800138000
  const phoneRegex = /^(\+?\d{1,3}[-\s]?)?\d{7,15}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate a password:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 */
export function isValidPassword(
  password: string
): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return {
      valid: false,
      message: '密码长度至少为 8 个字符',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: '密码必须包含至少一个大写字母',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: '密码必须包含至少一个小写字母',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: '密码必须包含至少一个数字',
    };
  }

  return { valid: true };
}

/**
 * Check if a value is not empty/null/undefined.
 * Works for strings, arrays, objects, and other types.
 */
export function isRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim().length === 0) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value as object).length === 0)
    return false;
  return true;
}

/**
 * Basic URL validation.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
