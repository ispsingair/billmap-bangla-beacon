import { describe, expect, it } from 'vitest';
import { validPolygon, containingZones } from './zones';
const boundary:[number,number][]=[[23.8,90.3],[23.8,90.4],[23.9,90.4],[23.9,90.3]];
describe('zone geometry',()=>{
  it('accepts an arbitrary valid polygon',()=>expect(validPolygon(boundary)).toBe(true));
  it('rejects crossing edges',()=>expect(validPolygon([[23.8,90.3],[23.9,90.4],[23.8,90.4],[23.9,90.3]])).toBe(false));
  it('rejects out of range coordinates',()=>expect(validPolygon([[91,90.3],[23.8,90.4],[23.9,90.3]])).toBe(false));
  it('uses stored latitude and longitude to find the containing zone',()=>{
    const zones=[{id:'b',polygon:boundary}];
    expect(containingZones(23.85,90.35,zones).map(z=>z.id)).toEqual(['b']);
    expect(containingZones(24,90.35,zones)).toHaveLength(0);
  });
  it('returns both matches for overlap rather than silently choosing one',()=>{
    expect(containingZones(23.85,90.35,[{id:'a',polygon:boundary},{id:'b',polygon:boundary}])).toHaveLength(2);
  });
});