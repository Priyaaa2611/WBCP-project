/**
 * Security & Encryption Service for AgroShield
 * Protects stored API credentials and gates administrative diagnostics.
 * Password: 1126
 */

const ADMIN_PASSWORD = '1126';
const STORAGE_KEY = 'agrishield_gemini_key_sec';
const LEGACY_STORAGE_KEY = 'agrishield_gemini_key';

/**
 * Verifies if the provided passcode matches the admin password (1126).
 */
export function verifyAdminPassword(password: string): boolean {
  return password?.trim() === ADMIN_PASSWORD;
}

/**
 * Derives a keystream from the secret password to encrypt/decrypt strings.
 */
function xorCipher(text: string, secret: string = ADMIN_PASSWORD): string {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ secret.charCodeAt(i % secret.length) ^ (i & 0x0f);
    result += String.fromCharCode(charCode);
  }
  return result;
}

/**
 * Encrypts a string using password 1126 and encodes as Base64 with an encryption header.
 */
export function encryptWithPassword(plaintext: string, secret: string = ADMIN_PASSWORD): string {
  if (!plaintext) return '';
  try {
    const cipher = xorCipher(plaintext, secret);
    const b64 = btoa(encodeURIComponent(cipher));
    return `enc:1126:${b64}`;
  } catch (err) {
    console.warn('Encryption fallback:', err);
    return plaintext;
  }
}

/**
 * Decrypts a string that was encrypted with password 1126.
 */
export function decryptWithPassword(ciphertext: string, secret: string = ADMIN_PASSWORD): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith('enc:1126:')) {
    // Might be raw unencrypted legacy string
    return ciphertext;
  }
  try {
    const rawB64 = ciphertext.replace('enc:1126:', '');
    const decoded = decodeURIComponent(atob(rawB64));
    return xorCipher(decoded, secret);
  } catch (err) {
    console.warn('Decryption error:', err);
    return '';
  }
}

/**
 * Retrieves the stored Gemini API key, decrypting it using password 1126.
 * Also handles transparent migration from legacy unencrypted storage.
 */
export function getSecureStoredApiKey(): string {
  if (typeof window === 'undefined') return '';

  // 1. Check encrypted storage first
  const encryptedVal = localStorage.getItem(STORAGE_KEY);
  if (encryptedVal) {
    const decrypted = decryptWithPassword(encryptedVal, ADMIN_PASSWORD);
    if (decrypted) return decrypted;
  }

  // 2. Fallback check for legacy unencrypted key, encrypt and migrate it
  const legacyVal = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyVal && legacyVal.trim()) {
    const clean = legacyVal.trim();
    setSecureStoredApiKey(clean);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return clean;
  }

  return '';
}

/**
 * Encrypts and securely saves the API key using password 1126.
 */
export function setSecureStoredApiKey(rawKey: string): void {
  if (typeof window === 'undefined') return;
  const clean = rawKey?.trim() || '';
  if (clean) {
    const encrypted = encryptWithPassword(clean, ADMIN_PASSWORD);
    localStorage.setItem(STORAGE_KEY, encrypted);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

/**
 * Clears the stored encrypted key.
 */
export function clearSecureStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
