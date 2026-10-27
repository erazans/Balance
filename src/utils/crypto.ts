/**
 * End-to-End Encryption (E2EE) Utility using Web Crypto API (PBKDF2 + AES-GCM 256-bit)
 * Ensures user weight and health logs are encrypted locally before leaving the device.
 */

export interface EncryptedVaultBundle {
  version: 'E2EE-AES256-GCM-V1';
  createdAt: string;
  saltHex: string;
  ivHex: string;
  cipherTextBase64: string;
  keyFingerprint: string;
  recordCount: number;
}

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveAesGcmKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 120000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function computeKeyFingerprint(passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await window.crypto.subtle.digest('SHA-256', enc.encode(`kiloobsidian:${passphrase}`));
  const hex = bufferToHex(digest).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export async function encryptHealthVault(
  payload: unknown,
  passphrase: string,
  recordCount: number
): Promise<EncryptedVaultBundle> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesGcmKey(passphrase, salt);

  const encodedPlaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encodedPlaintext
  );

  const fingerprint = await computeKeyFingerprint(passphrase);

  return {
    version: 'E2EE-AES256-GCM-V1',
    createdAt: new Date().toISOString(),
    saltHex: bufferToHex(salt),
    ivHex: bufferToHex(iv),
    cipherTextBase64: bufferToBase64(cipherBuffer),
    keyFingerprint: fingerprint,
    recordCount,
  };
}

export async function decryptHealthVault<T>(
  bundle: EncryptedVaultBundle,
  passphrase: string
): Promise<T> {
  const salt = hexToBytes(bundle.saltHex);
  const iv = hexToBytes(bundle.ivHex);
  const key = await deriveAesGcmKey(passphrase, salt);

  const cipherBuffer = base64ToBuffer(bundle.cipherTextBase64);
  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    cipherBuffer
  );

  const jsonStr = new TextDecoder().decode(plainBuffer);
  return JSON.parse(jsonStr) as T;
}
