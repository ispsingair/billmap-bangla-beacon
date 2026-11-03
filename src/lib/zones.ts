import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
export function validPolygon(points:[number,number][]) {
  if(points.length<3||points.some(([lat,lng])=>!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)) return false;
  const ring=points.map(([lat,lng])=>[lng,lat]); const first=ring[0]; if(!first)return false;
  try {return new Set(points.map(p=>p.join(','))).size>=3&&kinks(polygon([[...ring,first]])).features.length===0;}catch{return false;}
}
export function containingZones<T extends {polygon:[number,number][]}>(lat:number,lng:number,zones:T[]) {
  return zones.filter(z=>{if(!validPolygon(z.polygon))return false;const ring=z.polygon.map(([a,b])=>[b,a]);const first=ring[0];return first?booleanPointInPolygon(point([lng,lat]),polygon([[...ring,first]])):false;});
}