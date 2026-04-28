// Full site link auditor. Crawls all internal links from the homepage,
// reports 404s, 301/302 redirects, and unreachable pages.
// Usage: node scripts/_audit-links.cjs [--base=http://localhost:5000]

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = (process.argv.find(a => a.startsWith('--base=')) || '--base=http://localhost:5000').split('=')[1];
const CONCURRENCY = 8;

const visited   = new Set();   // URLs checked
const pending   = [];          // URLs to check
const results   = { ok: [], redirect: [], notFound: [], error: [] };
const linkGraph = new Map();   // url -> found-on page

function normalise(raw, fromUrl) {
  try {
    const u = new URL(raw, fromUrl);
    if (u.origin !== new URL(BASE).origin) return null; // external
    u.hash = '';
    u.search = '';
    // ensure trailing slash for non-file paths
    if (!u.pathname.includes('.') && !u.pathname.endsWith('/')) u.pathname += '/';
    return u.href;
  } catch { return null; }
}

function fetch(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', e => resolve({ status: 0, error: e.message, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout', body: '' }); });
  });
}

function extractLinks(html, fromUrl) {
  const links = new Set();
  // href="..." and action="..."
  const re = /(?:href|action|src)=["']([^"'#?][^"']*?)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const norm = normalise(m[1], fromUrl);
    if (norm) links.add(norm);
  }
  return links;
}

async function worker() {
  while (pending.length > 0) {
    const url = pending.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    const { status, headers, body, error } = await fetch(url);
    const foundOn = linkGraph.get(url) || '(seed)';

    if (error || status === 0) {
      results.error.push({ url, error: error || 'no response', foundOn });
    } else if (status === 404) {
      results.notFound.push({ url, foundOn });
    } else if (status === 301 || status === 302 || status === 308) {
      const loc = headers.location || '';
      results.redirect.push({ url, status, to: loc, foundOn });
      // Follow redirect to check destination
      const dest = normalise(loc, url);
      if (dest && !visited.has(dest)) {
        linkGraph.set(dest, `${url} [redirect]`);
        pending.push(dest);
      }
    } else if (status >= 200 && status < 300) {
      results.ok.push(url);
      // Extract links from HTML pages
      if (body && (body.includes('<html') || body.includes('<!DOCTYPE'))) {
        for (const link of extractLinks(body, url)) {
          if (!visited.has(link) && !pending.includes(link)) {
            linkGraph.set(link, url);
            pending.push(link);
          }
        }
      }
    } else {
      results.error.push({ url, error: `HTTP ${status}`, foundOn });
    }

    process.stdout.write(`\r  Crawled: ${visited.size} | Queue: ${pending.length} | 404s: ${results.notFound.length} | Redirects: ${results.redirect.length}   `);
  }
}

async function main() {
  console.log(`\nAuditing: ${BASE}\n`);
  const seed = normalise('/', BASE);
  pending.push(seed);
  linkGraph.set(seed, '(seed)');

  // Also seed important top-level pages
  const seeds = [
    '/all-supplements/',
    '/vitamins/', '/minerals/', '/omega-fatty-acids/', '/food-supplements/',
    '/health-goals/', '/weight-management/', '/womens-health/', '/mens-health/',
    '/herbal-supplements/', '/protein/', '/collagen/', '/probiotics-gut-health/',
    '/specialty-supplements/', '/lifestyle-supplements/',
  ];
  for (const s of seeds) {
    const u = normalise(s, BASE);
    if (u && !visited.has(u)) { pending.push(u); linkGraph.set(u, '(seed)'); }
  }

  // Run workers in parallel
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log('\n\n' + '='.repeat(70));
  console.log(`AUDIT COMPLETE — ${visited.size} URLs checked`);
  console.log('='.repeat(70));

  if (results.notFound.length === 0) {
    console.log('\n✓ No 404 errors found!');
  } else {
    console.log(`\n404 ERRORS (${results.notFound.length}):`);
    for (const r of results.notFound) {
      console.log(`  404  ${r.url}`);
      console.log(`       Found on: ${r.foundOn}`);
    }
  }

  if (results.redirect.length === 0) {
    console.log('\n✓ No redirects found!');
  } else {
    console.log(`\nREDIRECTS (${results.redirect.length}):`);
    for (const r of results.redirect) {
      console.log(`  ${r.status}  ${r.url}`);
      console.log(`       -> ${r.to}`);
      console.log(`       Found on: ${r.foundOn}`);
    }
  }

  if (results.error.length > 0) {
    console.log(`\nERRORS (${results.error.length}):`);
    for (const r of results.error) {
      console.log(`  ERR  ${r.url}  [${r.error}]`);
      console.log(`       Found on: ${r.foundOn}`);
    }
  }

  console.log(`\nSummary: ${results.ok.length} OK | ${results.notFound.length} 404 | ${results.redirect.length} redirects | ${results.error.length} errors`);
}

main().catch(e => { console.error(e); process.exit(1); });
