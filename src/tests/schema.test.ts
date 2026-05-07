import { describe, it, expect } from 'vitest';
import { getProductImageAlt, getCategoryImageAlt } from '../lib/schema';

describe('getProductImageAlt', () => {
  it('returns brand + name for single image', () => {
    expect(getProductImageAlt('Omega-3', 0, 1, 'Life Extension')).toBe('Life Extension Omega-3');
  });

  it('returns name only when no brand', () => {
    expect(getProductImageAlt('Vitamin C', 0, 1)).toBe('Vitamin C');
    expect(getProductImageAlt('Vitamin C', 0, 1, '')).toBe('Vitamin C');
  });

  it('appends view description for multi-image products', () => {
    expect(getProductImageAlt('Omega-3', 0, 3, 'Life Extension')).toBe('Life Extension Omega-3 - Front View');
    expect(getProductImageAlt('Omega-3', 1, 3, 'Life Extension')).toBe('Life Extension Omega-3 - Label View');
    expect(getProductImageAlt('Omega-3', 2, 3, 'Life Extension')).toBe('Life Extension Omega-3 - Back View');
  });

  it('falls back to View N for unknown index', () => {
    expect(getProductImageAlt('Product', 9, 10)).toBe('Product - View 10');
  });

  it('does NOT contain "price in Kenya" or regional suffix', () => {
    const alt = getProductImageAlt('Ashwagandha', 0, 1, 'Life Extension');
    expect(alt.toLowerCase()).not.toContain('price');
    expect(alt.toLowerCase()).not.toContain('kenya');
  });
});

describe('getCategoryImageAlt', () => {
  it('returns just the category name', () => {
    expect(getCategoryImageAlt('Vitamins & Minerals')).toBe('Vitamins & Minerals');
    expect(getCategoryImageAlt('Protein')).toBe('Protein');
  });

  it('does NOT contain "price in Kenya" or verbose suffix', () => {
    const alt = getCategoryImageAlt('Collagen');
    expect(alt.toLowerCase()).not.toContain('price');
    expect(alt.toLowerCase()).not.toContain('kenya');
    expect(alt.toLowerCase()).not.toContain('shop now');
    expect(alt.toLowerCase()).not.toContain('supplements category');
  });
});
