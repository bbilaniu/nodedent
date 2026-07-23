export const CLINICAL_VAULT_FORMAT_VERSION = 1 as const;
export const CLINICAL_VAULT_KDF_ITERATIONS = 600_000;
export const CLINICAL_VAULT_MAX_KDF_ITERATIONS = 2_000_000;
export const CLINICAL_VAULT_MIN_PASSPHRASE_LENGTH = 12;
export const CLINICAL_VAULT_MAX_PASSPHRASE_LENGTH = 128;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type ClinicalVaultKdf = {
  name: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
  salt: string;
};

export type ClinicalVaultEnvelope = {
  version: typeof CLINICAL_VAULT_FORMAT_VERSION;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function validateClinicalVaultPassphrase(passphrase: string) {
  if (passphrase.length < CLINICAL_VAULT_MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Unlock passphrase must be at least ${CLINICAL_VAULT_MIN_PASSPHRASE_LENGTH} characters.`);
  }
  if (passphrase.length > CLINICAL_VAULT_MAX_PASSPHRASE_LENGTH) {
    throw new Error(`Unlock passphrase must be at most ${CLINICAL_VAULT_MAX_PASSPHRASE_LENGTH} characters.`);
  }
}

export function createClinicalVaultKdf(): ClinicalVaultKdf {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return {
    name: "PBKDF2",
    hash: "SHA-256",
    iterations: CLINICAL_VAULT_KDF_ITERATIONS,
    salt: bytesToBase64(salt),
  };
}

export async function deriveClinicalVaultKey(passphrase: string, kdf: ClinicalVaultKdf) {
  validateClinicalVaultPassphrase(passphrase);
  if (
    kdf.name !== "PBKDF2" ||
    kdf.hash !== "SHA-256" ||
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations < 100_000 ||
    kdf.iterations > CLINICAL_VAULT_MAX_KDF_ITERATIONS
  ) {
    throw new Error("Unsupported clinical vault key-derivation settings.");
  }
  const salt = base64ToBytes(kdf.salt);
  if (salt.length !== 16) throw new Error("Unsupported clinical vault key-derivation salt.");

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: kdf.hash,
      iterations: kdf.iterations,
      salt,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptClinicalVaultValue(key: CryptoKey, value: unknown, additionalData: string): Promise<ClinicalVaultEnvelope> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: textEncoder.encode(additionalData),
      tagLength: 128,
    },
    key,
    plaintext
  );

  return {
    version: CLINICAL_VAULT_FORMAT_VERSION,
    algorithm: "AES-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptClinicalVaultValue<T>(key: CryptoKey, envelope: ClinicalVaultEnvelope, additionalData: string): Promise<T> {
  if (envelope.version !== CLINICAL_VAULT_FORMAT_VERSION || envelope.algorithm !== "AES-GCM") {
    throw new Error("Unsupported clinical vault encryption envelope.");
  }

  const plaintext = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(envelope.iv),
      additionalData: textEncoder.encode(additionalData),
      tagLength: 128,
    },
    key,
    base64ToBytes(envelope.ciphertext)
  );

  return JSON.parse(textDecoder.decode(plaintext)) as T;
}
