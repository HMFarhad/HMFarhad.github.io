/** Match the locally hosted interface font; no remote font dependency. */
export const HOLO_FONT = '"DM Sans", system-ui, sans-serif';

/** Wait for the font before drawing text into the hologram canvases. */
export async function ensureHoloFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all([
    document.fonts.load('400 16px "DM Sans"'),
    document.fonts.load('700 16px "DM Sans"'),
  ]);
  await document.fonts.ready;
}
