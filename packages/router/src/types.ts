export interface ClassEntry {
  provider: string;
  model: string;
}

export interface RouterModel {
  version: number;
  featureCount: number;
  classCount: number;
  bias: Float32Array;
  weights: Float32Array; // row-major [featureCount * classCount]
  classes: ClassEntry[];
}

export interface RouteDecision {
  provider: string;
  model: string;
  confidence: number;
  classIndex: number;
}

export interface FeatureContext {
  prompt: string;
  fileExt?: string;
  diagnosticCount?: number;
  openFileCount?: number;
  selectionLength?: number;
  hasImage?: boolean;
  historyDepth?: number;
}
