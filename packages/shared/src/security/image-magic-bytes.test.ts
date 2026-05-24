import { describe, expect, it } from 'vitest';
import { assertImageMagicBytes } from './image-magic-bytes';

describe('assertImageMagicBytes', () => {
  it('accepts PNG signature', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(assertImageMagicBytes(png)).toBeNull();
  });

  it('accepts JPEG signature', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(assertImageMagicBytes(jpeg)).toBeNull();
  });

  it('accepts GIF87a signature', () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(assertImageMagicBytes(gif)).toBeNull();
  });

  it('accepts GIF89a signature', () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(assertImageMagicBytes(gif)).toBeNull();
  });

  it('accepts WebP signature', () => {
    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(assertImageMagicBytes(webp)).toBeNull();
  });

  it('rejects HTML disguised as image (renamed .png)', () => {
    const html = Buffer.from('<!doctype html><script>alert(1)</script>', 'utf8');
    expect(assertImageMagicBytes(html)).toBe('invalid-image');
  });

  it('rejects PE / EXE disguised as image', () => {
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // 'MZ'
    expect(assertImageMagicBytes(pe)).toBe('invalid-image');
  });

  it('rejects empty / tiny buffer', () => {
    expect(assertImageMagicBytes(Buffer.alloc(0))).toBe('invalid-image');
    expect(assertImageMagicBytes(Buffer.from([0x00]))).toBe('invalid-image');
  });

  it('accepts a Uint8Array input', () => {
    const u8 = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(assertImageMagicBytes(u8)).toBeNull();
  });
});
