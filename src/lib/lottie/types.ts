// src/lib/lottie/types.ts — Bodymovin Lottie AST schema and analysis types

export type LayerType =
  | 0 // Precomposition
  | 1 // Solid
  | 2 // Image
  | 3 // Null
  | 4 // Shape
  | 5 // Text
  | 6 // Audio
  | 7 // Video Placeholder / Ph
  | 8 // Image Sequence
  | 9 // Graphic
  | 13; // Camera

export interface LottieAsset {
  id: string;
  w?: number;
  h?: number;
  u?: string; // Directory or base path
  p?: string; // Filename or Data URI (e.g. "data:image/png;base64,...")
  e?: number; // 1 = embedded, 0 = external
  layers?: LottieLayer[]; // For precompositions
  xt?: number;
  t?: string;
}

export interface LottieLayer {
  ind?: number; // Layer index (1-based integer)
  ty: LayerType; // Layer type
  nm?: string; // Layer name
  parent?: number; // Parent layer index reference
  refId?: string; // Reference ID to assets[] item (for precomp or image)
  ip: number; // In-point frame
  op: number; // Out-point frame
  st?: number; // Start time frame
  sr?: number; // Time stretch
  ks?: Record<string, unknown>; // Transform keyframes (anchor, position, scale, rotation, opacity)
  hd?: boolean; // Hidden/disabled layer flag
  shapes?: unknown[]; // For shape layers
  bm?: number; // Blend mode
  cl?: string; // HTML class name
  ln?: string; // HTML ID
  hasMask?: boolean;
  masksProperties?: unknown[];
  ef?: unknown[]; // Effects
  w?: number;
  h?: number;
  sw?: number; // Solid color width
  sh?: number; // Solid color height
  sc?: string; // Solid color hex
  t?: unknown; // Text data
  ao?: number; // Auto-orient
  ddd?: number; // 3D layer flag
  [key: string]: unknown;
}

export interface LottieMarker {
  tm: number; // Time (frame)
  cm: string; // Comment / name
  dr: number; // Duration
}

export interface LottieAnimation {
  v?: string; // Bodymovin version string (e.g. "5.7.4")
  fr?: number; // Framerate (FPS)
  ip?: number; // In-point frame
  op?: number; // Out-point frame
  w?: number; // Composition width in pixels
  h?: number; // Composition height in pixels
  nm?: string; // Animation name
  ddd?: number; // 3D flag
  assets?: LottieAsset[];
  layers?: LottieLayer[];
  markers?: LottieMarker[];
  meta?: Record<string, unknown>;
  chars?: unknown[];
  [key: string]: unknown;
}

// ── Validation Types ───────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: 'schema' | 'hierarchy' | 'asset' | 'performance';
  title: string;
  message: string;
  location?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
}

// ── Analysis Types ─────────────────────────────────────────────

export interface LottieMetadata {
  version: string | null;
  framerate: number | null;
  inPoint: number | null;
  outPoint: number | null;
  totalFrames: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  name: string | null;
  missingProperties: string[];
}

export interface LottieAssetInfo {
  id: string;
  type: 'image-embedded' | 'image-external' | 'precomp' | 'audio' | 'unknown';
  width?: number;
  height?: number;
  path?: string;
  isEmbedded: boolean;
  byteSize?: number;
  previewUrl?: string;
  warning?: string;
}

export interface LottieLayerStats {
  total: number;
  shapes: number;
  precomps: number;
  solids: number;
  images: number;
  texts: number;
  nulls: number;
  hidden: number;
  hasExpressions: boolean;
  maxNestingDepth: number;
}

export interface LottieAnalysisResult {
  metadata: LottieMetadata;
  layerStats: LottieLayerStats;
  assets: LottieAssetInfo[];
  totalAssetBytes: number;
  rawJsonBytes: number;
  rasterPercentage: number;
  isClean: boolean;
}

// ── Optimization Types ─────────────────────────────────────────

export interface LottieOptimizationOptions {
  /** Round coordinate floats to specified decimal places (e.g. 2 or 3). Set to false to disable. */
  roundPrecision: number | false;
  /** Strip layer and shape names (`nm`) */
  removeEditorNames: boolean;
  /** Strip timeline markers */
  removeMarkers: boolean;
  /** Strip disabled/hidden layers (`hd: true`) */
  removeHiddenLayers: boolean;
  /** Strip extra metadata (`meta`, comments) */
  removeMetadata: boolean;
  /** Format JSON compactly without indentation */
  minifyWhitespace: boolean;
}

export interface LottieOptimizationResult {
  optimizedAnimation: LottieAnimation;
  optimizedJson: string;
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savingsPercentage: number;
}

