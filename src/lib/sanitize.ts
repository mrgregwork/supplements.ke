/**
 * Server-side HTML sanitizer for rich text content.
 * Whitelists safe HTML tags and attributes to prevent XSS.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'img', 'div', 'span',
  // Previously missing, which is why the strikethrough button appeared to do
  // nothing: execCommand emits <strike>/<s>, and both were stripped on save.
  's', 'strike', 'del', 'mark', 'sub', 'sup', 'blockquote', 'hr', 'code', 'pre',
  'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
]);

/**
 * CSS properties an editor is allowed to persist, with the shapes their values
 * may take. Highlighting and text alignment both round-trip as inline styles,
 * so blocking style outright silently threw that formatting away.
 *
 * Values are matched against explicit patterns rather than passed through:
 * url(), expression(), behaviour bindings and escapes never match, so this
 * cannot smuggle a script or load a remote asset.
 */
const ALLOWED_CSS: Record<string, RegExp> = {
  'text-align': /^(left|right|center|justify)$/i,
  'background-color': /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|transparent|[a-z]{3,20})$/i,
  'color': /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i,
  'font-weight': /^(normal|bold|[1-9]00)$/i,
  'font-style': /^(normal|italic)$/i,
  'text-decoration': /^(none|underline|line-through)$/i,
};

function sanitizeStyle(value: string): string | null {
  const safe: string[] = [];
  for (const declaration of value.split(';')) {
    const idx = declaration.indexOf(':');
    if (idx < 0) continue;
    const prop = declaration.slice(0, idx).trim().toLowerCase();
    const val = declaration.slice(idx + 1).trim();
    if (!val || val.length > 40) continue;
    const pattern = ALLOWED_CSS[prop];
    if (pattern && pattern.test(val)) safe.push(`${prop}: ${val}`);
  }
  return safe.length ? safe.join('; ') : null;
}

/** Tags that may carry style/class for alignment, highlighting and colour. */
const STYLEABLE = new Set([
  'p', 'div', 'span', 'mark', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'ul', 'ol', 'blockquote', 'td', 'th', 'table', 'figure', 'figcaption',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  'a': new Set(['href', 'title', 'target', 'rel']),
  'img': new Set(['src', 'alt', 'class', 'width', 'height', 'loading', 'style']),
  'td': new Set(['colspan', 'rowspan', 'style', 'class']),
  'th': new Set(['colspan', 'rowspan', 'scope', 'style', 'class']),
};

const SELF_CLOSING_TAGS = new Set(['br', 'img']);

interface ParsedTag {
  isClosing: boolean;
  tagName: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
}

function parseTag(tagContent: string): ParsedTag | null {
  const isClosing = tagContent.startsWith('/');
  const content = isClosing ? tagContent.slice(1) : tagContent;
  
  const match = content.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  if (!match) return null;
  
  const tagName = match[1].toLowerCase();
  const selfClosing = tagContent.endsWith('/') || SELF_CLOSING_TAGS.has(tagName);
  
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']([^"']*)["']/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(content)) !== null) {
    attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
  }
  
  return { isClosing, tagName, attrs, selfClosing };
}

export function sanitizeHTML(html: string | null | undefined): string | null {
  if (!html || typeof html !== 'string') return null;
  
  const trimmed = html.trim();
  if (!trimmed || trimmed === '<br>') return null;
  
  let result = '';
  let pos = 0;
  
  while (pos < trimmed.length) {
    const tagStart = trimmed.indexOf('<', pos);
    
    if (tagStart === -1) {
      // No more tags, append remaining text
      result += escapeHtml(trimmed.slice(pos));
      break;
    }
    
    // Append text before tag
    if (tagStart > pos) {
      result += escapeHtml(trimmed.slice(pos, tagStart));
    }
    
    const tagEnd = trimmed.indexOf('>', tagStart);
    if (tagEnd === -1) {
      // Malformed tag, escape and append rest
      result += escapeHtml(trimmed.slice(tagStart));
      break;
    }
    
    const tagContent = trimmed.slice(tagStart + 1, tagEnd);
    const parsed = parseTag(tagContent);
    
    if (parsed && ALLOWED_TAGS.has(parsed.tagName)) {
      if (parsed.isClosing) {
        result += `</${parsed.tagName}>`;
      } else {
        const allowedAttrsForTag = ALLOWED_ATTRS[parsed.tagName] || new Set();
        const sanitizedAttrs: string[] = [];
        
        for (const [key, value] of Object.entries(parsed.attrs)) {
          // style/class on styleable tags: alignment, highlight and colour.
          if ((key === 'style' || key === 'class') && STYLEABLE.has(parsed.tagName)) {
            if (key === 'style') {
              const safeStyle = sanitizeStyle(value);
              if (safeStyle) sanitizedAttrs.push(`style="${escapeHtml(safeStyle)}"`);
            } else if (/^[\w\s:-]{1,120}$/.test(value)) {
              sanitizedAttrs.push(`class="${escapeHtml(value)}"`);
            }
            continue;
          }
          if (key === 'style' && allowedAttrsForTag.has('style')) {
            const safeStyle = sanitizeStyle(value);
            if (safeStyle) sanitizedAttrs.push(`style="${escapeHtml(safeStyle)}"`);
            continue;
          }
          if (allowedAttrsForTag.has(key)) {
            // Sanitize attribute values
            const sanitizedValue = escapeHtml(value);
            // Block javascript: URLs
            if (key === 'href' || key === 'src') {
              if (value.trim().toLowerCase().startsWith('javascript:')) {
                continue;
              }
            }
            sanitizedAttrs.push(`${key}="${sanitizedValue}"`);
          }
        }
        
        // Add safety attributes for links
        if (parsed.tagName === 'a') {
          if (!parsed.attrs['rel']) {
            sanitizedAttrs.push('rel="noopener noreferrer"');
          }
        }
        
        const attrString = sanitizedAttrs.length > 0 ? ' ' + sanitizedAttrs.join(' ') : '';
        
        if (parsed.selfClosing || SELF_CLOSING_TAGS.has(parsed.tagName)) {
          result += `<${parsed.tagName}${attrString} />`;
        } else {
          result += `<${parsed.tagName}${attrString}>`;
        }
      }
    }
    // Disallowed tags are silently stripped (their content is preserved through text extraction)
    
    pos = tagEnd + 1;
  }
  
  return result || null;
}

function escapeHtml(text: string): string {
  return text
    // Don't double-encode existing HTML entities (e.g. &nbsp; &amp; &#160; etc.)
    .replace(/&(?![a-zA-Z]{2,8};|#\d{1,6};|#x[\da-fA-F]{1,6};)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
