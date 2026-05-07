/**
 * Server-side HTML sanitizer for rich text content.
 * Whitelists safe HTML tags and attributes to prevent XSS.
 */

const ALLOWED_TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'img']);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  'a': new Set(['href', 'title', 'target', 'rel']),
  'img': new Set(['src', 'alt', 'class', 'width', 'height'])
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
