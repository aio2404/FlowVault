import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from '../tokens.js';

describe('token utilities', () => {
  it('generates different tokens of expected length', () => {
    const tokenA = generateToken();
    const tokenB = generateToken();

    expect(tokenA).toHaveLength(96); // 48 bytes hex encoded
    expect(tokenB).toHaveLength(96);
    expect(tokenA).not.toEqual(tokenB);
  });

  it('hashes tokens deterministically', () => {
    const token = 'test-token-value';
    const hashedA = hashToken(token);
    const hashedB = hashToken(token);
    const hashedC = hashToken('another-token');

    expect(hashedA).toEqual(hashedB);
    expect(hashedA).toHaveLength(64);
    expect(hashedA).not.toEqual(hashedC);
  });
});
