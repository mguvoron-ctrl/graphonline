export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Invalid zoom');
  return Math.min(20, Math.max(0.01, scale));
}

// WheelEvent.deltaY works for mice, trackpads and Ctrl+wheel pinch gestures.
export function wheelZoomFactor(deltaY: number, mode = 0, pinch = false): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
  const pixels = deltaY * (mode === 1 ? 16 : mode === 2 ? 800 : 1);
  return Math.exp(-Math.max(-100, Math.min(100, pixels)) * (pinch ? 0.01 : 0.002));
}
