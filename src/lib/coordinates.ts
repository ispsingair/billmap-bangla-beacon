export function parseCoordinates(lat: string, lng: string): { lat: number; lng: number } | null {
  if (lat.trim() === "" || lng.trim() === "") return null;
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}