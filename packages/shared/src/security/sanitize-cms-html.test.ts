import { describe, expect, it } from 'vitest';
import { sanitizeCmsHtml } from './sanitize-cms-html';

describe('sanitizeCmsHtml', () => {
  it('keeps safe CMS formatting tags', () => {
    const html = '<h2>Tea</h2><p><strong>Fresh</strong> menu <a href="/menu">link</a></p>';
    expect(sanitizeCmsHtml(html)).toBe(html);
  });

  it('removes scripts, event handlers, and javascript URLs', () => {
    const html =
      '<p onclick="alert(1)">Halo</p><script>alert(2)</script><a href="javascript:alert(3)">klik</a><img src=x onerror=alert(4)>';

    const sanitized = sanitizeCmsHtml(html);

    expect(sanitized).toContain('<p>Halo</p>');
    expect(sanitized).toContain('<a>klik</a>');
    expect(sanitized).toContain('<img loading="lazy">');
    expect(sanitized).not.toContain('script');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('javascript:');
  });

  it('removes dangerous SVG and iframe payloads', () => {
    const html = '<svg><animate onbegin=alert(1) /></svg><iframe src="https://evil.test"></iframe><p>safe</p>';

    expect(sanitizeCmsHtml(html)).toBe('<p>safe</p>');
  });

  it('forces noopener on target blank links', () => {
    const sanitized = sanitizeCmsHtml('<a href="https://aroadritea.com" target="_blank">Aroadri</a>');

    expect(sanitized).toBe(
      '<a href="https://aroadritea.com" target="_blank" rel="noopener noreferrer">Aroadri</a>',
    );
  });
});
