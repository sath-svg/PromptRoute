#!/usr/bin/env node
// Generates a placeholder router.pk1 + classes.json.
// Bias-only model: everything routes to Sonnet by default.
// Replace with a trained model before shipping.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../apps/desktop/src-tauri/resources/models");
mkdirSync(outDir, { recursive: true });

const VERSION = 1;
const FEATURE_COUNT = 41; // see packages/router/src/features.ts
const CLASSES = [
  { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  { provider: "anthropic", model: "claude-sonnet-4-6" },
  { provider: "anthropic", model: "claude-opus-4-7" },
  { provider: "openai", model: "gpt-4o" }
];
const CLASS_COUNT = CLASSES.length;

// Bias: prefer Sonnet by default (index 1).
const bias = new Float32Array([0.0, 1.0, 0.0, 0.0]);

// Weights: feature 0 (length) nudges toward Opus when long;
// feature 1 (code fence) nudges toward Sonnet;
// feature 2 (keyword count) nudges toward Opus.
// Everything else = 0.
const weights = new Float32Array(FEATURE_COUNT * CLASS_COUNT);
const set = (f, c, v) => {
  weights[f * CLASS_COUNT + c] = v;
};
set(0, 2, 0.4); // long → opus
set(0, 0, -0.2); // long → not haiku
set(1, 1, 0.3); // code fence → sonnet
set(2, 2, 0.5); // many keywords → opus

const headerLen = 4 + 2 + 2 + 2;
const buf = Buffer.alloc(headerLen + bias.byteLength + weights.byteLength);
buf.write("PK1\0", 0, 4, "binary");
buf.writeUInt16LE(VERSION, 4);
buf.writeUInt16LE(FEATURE_COUNT, 6);
buf.writeUInt16LE(CLASS_COUNT, 8);
let cursor = 10;
for (const v of bias) {
  buf.writeFloatLE(v, cursor);
  cursor += 4;
}
for (const v of weights) {
  buf.writeFloatLE(v, cursor);
  cursor += 4;
}

writeFileSync(resolve(outDir, "router.pk1"), buf);
writeFileSync(
  resolve(outDir, "router.classes.json"),
  JSON.stringify({ classes: CLASSES }, null, 2)
);

const manifest = {
  version: VERSION,
  url: "https://api.pmtpk.com/models/router.pk1",
  sha256: "<fill-on-server-publish>",
  classMapUrl: "https://api.pmtpk.com/models/router.classes.json",
  classMapSha256: "<fill-on-server-publish>",
  releasedAt: new Date().toISOString()
};
writeFileSync(
  resolve(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

console.log(`wrote ${buf.byteLength} bytes to router.pk1`);
console.log(`classes: ${CLASSES.length}, features: ${FEATURE_COUNT}`);
