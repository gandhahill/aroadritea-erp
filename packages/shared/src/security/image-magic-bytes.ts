/**
 * Image magic-byte sniffing for upload validation.
 *
 * Client-supplied MIME types and file extensions are not trustworthy:
 * an attacker can rename `evil.html` to `evil.png` and feed it to an
 * upload handler. If the handler ever serves the bytes back with an
 * image content-type, the browser will still try to interpret HTML
 * inside the response, opening XSS via stored-file. We validate the
 * first few bytes against the well-known image signatures instead.
 *
 * Returns `null` on success or a short string error code on rejection
 * so the caller can map it to a localised message.
 */
export function assertImageMagicBytes(buffer: Buffer | Uint8Array): null | string {
  const b = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  if (b.length < 4) return 'invalid-image';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return null;

  // JPEG: FF D8 FF (covers JFIF, EXIF, SPIFF, raw)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return null;

  // GIF87a / GIF89a: 47 49 46 38 (37|39) 61
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return null;

  // WebP: 'RIFF' .... 'WEBP'
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return null;
  }

  // BMP: 'BM'
  if (b[0] === 0x42 && b[1] === 0x4d) return null;

  return 'invalid-image';
}
