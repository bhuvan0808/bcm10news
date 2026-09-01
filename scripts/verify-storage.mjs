#!/usr/bin/env node
/**
 * End-to-end check of the media pipeline against real R2.
 *
 * Signs an upload exactly as the newsroom does, PUTs bytes with only the
 * headers the browser would send, reads the object back from the public CDN
 * URL, then deletes it.
 *
 * This is the part of the system most likely to fail for environmental reasons
 * — a wrong endpoint, missing CORS, a signature that does not match the headers
 * the browser actually sends — so it is worth exercising for real rather than
 * mocking.
 *
 * Usage: node scripts/verify-storage.mjs
 */

import { R2MediaService } from '../packages/storage/src/r2.ts';

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
};

for (const [key, value] of Object.entries(config)) {
  if (!value) {
    console.error(`Missing ${key}`);
    process.exit(1);
  }
}

// A 1x1 transparent PNG — the smallest thing that is genuinely an image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  ok ? (passed += 1) : (failed += 1);
}

async function main() {
  const media = new R2MediaService(config);
  console.log(`\nR2 bucket: ${config.bucket}\nPublic base: ${config.publicBaseUrl}\n`);

  const signed = await media.createSignedUpload({
    kind: 'image',
    mimeType: 'image/png',
    sizeBytes: PNG.length,
  });

  check('upload URL is signed', signed.uploadUrl.includes('X-Amz-Signature'));
  check(
    'storage key is date-partitioned',
    /^images\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/.test(signed.storageKey),
    signed.storageKey
  );

  // Exactly what the browser sends: the signed headers, nothing else.
  const put = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: signed.headers,
    body: PNG,
  });
  check(
    'browser-style PUT is accepted',
    put.ok,
    `HTTP ${put.status} ${await put.text().catch(() => '')}`
  );

  const exists = await media.objectExists(signed.storageKey);
  check('object confirmed present', exists);

  // The CDN can take a moment to see a brand-new object.
  const publicUrl = media.publicUrl(signed.storageKey);
  let readable = false;
  let status = 0;
  for (let attempt = 0; attempt < 5 && !readable; attempt += 1) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500));
    const response = await fetch(publicUrl, { method: 'GET' });
    status = response.status;
    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      readable = bytes.equals(PNG);
    }
  }
  check(
    'object readable over the public URL, byte-identical',
    readable,
    `HTTP ${status} at ${publicUrl}`
  );

  await media.deleteObject(signed.storageKey);
  check('object deleted', !(await media.objectExists(signed.storageKey)));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nStorage verification aborted: ${error.message}`);
  process.exit(1);
});
