/**
 * Strong password policy for Store1920 (Firebase Auth stores hashes).
 * Client and server must both enforce this before createUser / updatePassword.
 */

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

export function validatePasswordStrength(password = '') {
  const value = String(password || '');
  const errors = [];

  if (value.length < PASSWORD_POLICY.minLength) {
    errors.push(`At least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (value.length > PASSWORD_POLICY.maxLength) {
    errors.push(`At most ${PASSWORD_POLICY.maxLength} characters`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(value)) {
    errors.push('One uppercase letter');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(value)) {
    errors.push('One lowercase letter');
  }
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(value)) {
    errors.push('One number');
  }
  if (PASSWORD_POLICY.requireSpecial) {
    const escaped = PASSWORD_POLICY.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`[${escaped}]`).test(value)) {
      errors.push('One special character (!@#$%…)');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    message: errors.length
      ? `Password must include: ${errors.join(', ')}`
      : 'Password meets policy',
  };
}

export function passwordPolicyPublic() {
  return {
    ...PASSWORD_POLICY,
    hashing: 'Firebase Auth (scrypt). App never stores raw or hashed passwords in MongoDB.',
    summary: `Min ${PASSWORD_POLICY.minLength} chars, upper, lower, number, special character.`,
  };
}
