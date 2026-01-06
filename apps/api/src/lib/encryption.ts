import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('APP_ENCRYPTION_KEY environment variable is required');
  }
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must be 32 bytes (256 bits) base64 encoded');
  }
  return decoded;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(encrypted: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

// Helper to encrypt and return object for Prisma
export function encryptForDb(plaintext: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const data = encrypt(plaintext);
  return {
    encrypted: data.ciphertext,
    iv: data.iv,
    tag: data.tag,
  };
}

// Helper to decrypt from Prisma fields
export function decryptFromDb(encrypted: string, iv: string, tag: string): string {
  return decrypt({ ciphertext: encrypted, iv, tag });
}



