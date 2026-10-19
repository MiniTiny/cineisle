export function captionShadows(edge: string): ShadowOptions[] {
  if (edge === 'uniform') { return [-1, 1].flatMap((x: number): ShadowOptions[] => [-1, 1].map((y: number): ShadowOptions => ({ radius: 0, color: '#FF000000', offsetX: x, offsetY: y }))); }
  if (edge === 'dropShadow') { return [{ radius: 2, color: '#FF000000', offsetX: 1, offsetY: 1 }]; }
  if (edge === 'raised' || edge === 'depressed') { const sign: number = edge === 'raised' ? 1 : -1; return [{ radius: 0, color: '#FFFFFFFF', offsetX: -sign, offsetY: -sign }, { radius: 0, color: '#FF000000', offsetX: sign, offsetY: sign }]; }
  return [{ radius: 0, color: '#00000000', offsetX: 0, offsetY: 0 }];
}
