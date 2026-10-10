/**
 * Quality tiers for the forest scene. Every system reads its instance counts
 * from the active profile, and the scene can drop one tier at runtime when the
 * measured frame rate is poor (see `ForestScene.applyTier`). Systems build for
 * the tier they start on and only ever *lower* counts afterwards, so a tier drop
 * never rebuilds geometry.
 */
export type QualityTier = 'high' | 'medium' | 'low';

export interface QualityProfile {
  tier: QualityTier;
  trees: number;
  heroTreesPerStation: number;
  ferns: number;
  grass: number;
  shrubs: number;
  canopyCards: number;
  vines: number;
  mistSprites: number;
  mistSheets: number;
  motes: number;
  leaves: number;
  birds: number;
  butterfliesPerStation: number;
  lightShafts: number;
  /** Directional-light shadow map (high tier only). */
  shadows: boolean;
  shadowMapSize: number;
  maxDpr: number;
  /** MSAA on the default framebuffer. Fixed at renderer creation. */
  antialias: boolean;
  /** Alpha-to-coverage on cutout cards; only meaningful with MSAA. */
  alphaToCoverage: boolean;
  /** HDRI image-based lighting (skipped below high to save the 1.9 MB download). */
  environment: boolean;
  fogDensity: number;
  cameraFar: number;
  terrainSegments: number;
  /** Landmark point lights shared between the nearest stations. */
  landmarkLights: number;
}

export const QUALITY: Record<QualityTier, QualityProfile> = {
  high: {
    tier: 'high',
    trees: 420, heroTreesPerStation: 2,
    ferns: 900, grass: 1400, shrubs: 160,
    canopyCards: 260, vines: 70,
    mistSprites: 40, mistSheets: 2,
    motes: 1200, leaves: 120,
    birds: 5, butterfliesPerStation: 3,
    lightShafts: 10,
    shadows: true, shadowMapSize: 2048,
    maxDpr: 2, antialias: true, alphaToCoverage: true,
    environment: true,
    fogDensity: 0.026, cameraFar: 180, terrainSegments: 256,
    landmarkLights: 2,
  },
  medium: {
    tier: 'medium',
    trees: 220, heroTreesPerStation: 2,
    ferns: 420, grass: 600, shrubs: 90,
    canopyCards: 140, vines: 32,
    mistSprites: 18, mistSheets: 1,
    motes: 500, leaves: 50,
    birds: 3, butterfliesPerStation: 2,
    lightShafts: 5,
    shadows: false, shadowMapSize: 0,
    maxDpr: 1.5, antialias: false, alphaToCoverage: false,
    environment: false,
    fogDensity: 0.030, cameraFar: 150, terrainSegments: 160,
    landmarkLights: 2,
  },
  low: {
    tier: 'low',
    trees: 140, heroTreesPerStation: 1,
    ferns: 200, grass: 250, shrubs: 50,
    canopyCards: 80, vines: 16,
    mistSprites: 8, mistSheets: 1,
    motes: 200, leaves: 0,
    birds: 2, butterfliesPerStation: 1,
    lightShafts: 0,
    shadows: false, shadowMapSize: 0,
    maxDpr: 1, antialias: false, alphaToCoverage: false,
    environment: false,
    fogDensity: 0.034, cameraFar: 120, terrainSegments: 128,
    landmarkLights: 1,
  },
};

/** Phones and touch-first devices start on medium; everything else on high. */
export function initialTier(mobile: boolean): QualityTier {
  return mobile ? 'medium' : 'high';
}

/** The next tier down, or null when already at the bottom. */
export function lowerTier(tier: QualityTier): QualityTier | null {
  if (tier === 'high') return 'medium';
  if (tier === 'medium') return 'low';
  return null;
}
