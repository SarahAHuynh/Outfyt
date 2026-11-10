// Run against a started app. No cookies, live mutations, or paid requests.
import assert from 'node:assert/strict';
const base=process.argv[2] || 'http://localhost:3000';
for (const path of ['/','/login','/this-page-does-not-exist','/api/style-dna']) {
  const response=await fetch(new URL(path,base),{ redirect:'manual' });
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.equal(response.headers.get('x-powered-by'),null);
  if (path.startsWith('/api')) assert.match(response.headers.get('cache-control') || '',/no-store/);
  if (path==='/this-page-does-not-exist') { assert.equal(response.status,404);assert.match(await response.text(),/Back to my studio/); }
  console.log(`PASS: release headers and response for ${path}`);
}
const callback=await fetch(new URL('/auth/callback',base),{ redirect:'manual' });
assert.equal(callback.headers.get('referrer-policy'),'no-referrer');assert.match(callback.headers.get('cache-control') || '',/no-store/);
console.log('PASS: confirmation redirects are not cached and suppress referrers');
const protectedPage=await fetch(new URL('/settings',base),{ redirect:'manual' });
assert.match(protectedPage.headers.get('cache-control') || '',/no-store/);
console.log('PASS: signed-out protected redirects are not cached');
