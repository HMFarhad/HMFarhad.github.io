/** Canvas font stack for holo panel text (loaded via index.html). */
export const HOLO_FONT = '"Outfit", system-ui, sans-serif';

/** Wait until Outfit is ready so panel canvases render with the correct face. */
export async function ensureHoloFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all([
    document.fonts.load('400 16px Outfit'),
    document.fonts.load('500 16px Outfit'),
    document.fonts.load('600 16px Outfit'),
    document.fonts.load('700 16px Outfit'),
    document.fonts.load('800 16px Outfit'),
  ]);
  await document.fonts.ready;
}
