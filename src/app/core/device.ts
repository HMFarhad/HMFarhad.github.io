/** True on narrow viewports or touch-primary devices. */
export function isMobileLayout(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
}
