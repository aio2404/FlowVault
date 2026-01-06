import crypto from 'crypto';

const TOKEN_BYTE_LENGTH = 48;

export function generateToken(bytes = TOKEN_BYTE_LENGTH): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
