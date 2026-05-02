import type { ClassEntry, RouterModel, RouteDecision } from "./types";
import { extractFeatures } from "./features";

const MAGIC = new Uint8Array([0x50, 0x4b, 0x31, 0x00]); // "PK1\0"

export class PK1ParseError extends Error {}

export function parsePK1(buffer: ArrayBuffer, classes: ClassEntry[]): RouterModel {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 10) throw new PK1ParseError("file too short");
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) throw new PK1ParseError("bad magic");
  }

  const version = view.getUint16(4, true);
  if (version !== 1) throw new PK1ParseError(`unsupported version ${version}`);

  const featureCount = view.getUint16(6, true);
  const classCount = view.getUint16(8, true);

  let cursor = 10;
  const bias = new Float32Array(classCount);
  for (let i = 0; i < classCount; i++) {
    bias[i] = view.getFloat32(cursor, true);
    cursor += 4;
  }

  const weightCount = featureCount * classCount;
  const weights = new Float32Array(weightCount);
  for (let i = 0; i < weightCount; i++) {
    weights[i] = view.getFloat32(cursor, true);
    cursor += 4;
  }

  if (classes.length !== classCount) {
    throw new PK1ParseError(
      `class map size (${classes.length}) != classCount (${classCount})`
    );
  }

  return { version, featureCount, classCount, bias, weights, classes };
}

export function route(model: RouterModel, ctx: { prompt: string } & Record<string, unknown>): RouteDecision {
  const features = extractFeatures(ctx as never, model.featureCount);
  const scores = new Float32Array(model.classCount);
  for (let i = 0; i < model.classCount; i++) scores[i] = model.bias[i]!;

  for (let fi = 0; fi < model.featureCount; fi++) {
    const x = features[fi]!;
    if (x === 0) continue;
    const row = fi * model.classCount;
    for (let cj = 0; cj < model.classCount; cj++) {
      scores[cj]! += x * model.weights[row + cj]!;
    }
  }

  let best = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]!;
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }

  const max = bestScore;
  let sum = 0;
  for (let i = 0; i < scores.length; i++) sum += Math.exp(scores[i]! - max);
  const confidence = sum === 0 ? 1 : Math.exp(scores[best]! - max) / sum;
  const entry = model.classes[best]!;

  return {
    provider: entry.provider,
    model: entry.model,
    confidence,
    classIndex: best
  };
}
