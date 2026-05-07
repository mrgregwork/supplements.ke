import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../lib/sanitize';

describe('sanitizeHTML', () => {
  it('returns null for empty input', () => {
    expect(sanitizeHTML('')).toBeNull();
    expect(sanitizeHTML(null)).toBeNull();
    expect(sanitizeHTML(undefined)).toBeNull();
    expect(sanitizeHTML('   ')).toBeNull();
    expect(sanitizeHTML('<br>')).toBeNull();
  });

  it('preserves allowed tags', () => {
    expect(sanitizeHTML('<p>Hello</p>')).toBe('<p>Hello</p>');
    expect(sanitizeHTML('<b>Bold</b>')).toBe('<b>Bold</b>');
    expect(sanitizeHTML('<strong>Strong</strong>')).toBe('<strong>Strong</strong>');
    expect(sanitizeHTML('<h2>Heading</h2>')).toBe('<h2>Heading</h2>');
    expect(sanitizeHTML('<ul><li>Item</li></ul>')).toBe('<ul><li>Item</li></ul>');
  });

  it('strips disallowed tags but keeps their text content', () => {
    expect(sanitizeHTML('<script>alert(1)</script>')).toBe('alert(1)');
    expect(sanitizeHTML('<style>body{color:red}</style>')).toBe('body{color:red}');
    expect(sanitizeHTML('<iframe src="x"></iframe>')).toBeNull(); // stripped, no text content left
    expect(sanitizeHTML('<p><script>x</script>Safe</p>')).toBe('<p>xSafe</p>');
  });

  it('blocks javascript: URLs in href', () => {
    const result = sanitizeHTML('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('click');
  });

  it('blocks javascript: URLs in src', () => {
    const result = sanitizeHTML('<img src="javascript:alert(1)" alt="x" />');
    expect(result).not.toContain('javascript:');
  });

  it('preserves safe link attributes and adds rel', () => {
    const result = sanitizeHTML('<a href="/products/x" title="Test">Link</a>');
    expect(result).toContain('href="/products/x"');
    expect(result).toContain('title="Test"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('strips disallowed attributes from allowed tags', () => {
    const result = sanitizeHTML('<p onclick="evil()" class="ok">Text</p>');
    expect(result).not.toContain('onclick');
    expect(result).toBe('<p>Text</p>');
  });

  it('does not double-encode existing HTML entities', () => {
    expect(sanitizeHTML('<p>&nbsp;</p>')).toBe('<p>&nbsp;</p>');
    expect(sanitizeHTML('<p>&amp;</p>')).toBe('<p>&amp;</p>');
    expect(sanitizeHTML('<p>&#160;</p>')).toBe('<p>&#160;</p>');
  });

  it('encodes bare & that are not entities', () => {
    const result = sanitizeHTML('<p>A & B</p>');
    expect(result).toBe('<p>A &amp; B</p>');
  });

  it('preserves nested allowed tags', () => {
    const input = '<ul><li><strong>Item 1</strong></li><li>Item 2</li></ul>';
    expect(sanitizeHTML(input)).toBe(input);
  });

  it('strips event handlers even on allowed tags', () => {
    const result = sanitizeHTML('<a href="/ok" onmouseover="evil()">Safe</a>');
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('href="/ok"');
  });
});
