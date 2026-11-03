import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import type { Zone } from '@/lib/data';
export default function ZoneDrawing({points,zones,onChange}:{points:[number,number][];zones:Zone[];onChange:(points:[number,number][])=>void}) {
  const el=useRef<HTMLDivElement>(null); const callback=useRef(onChange);callback.current=onChange;
  const initial=useRef(points);
  useEffect(()=>{
    if(!el.current)return;
    const map=L.map(el.current).setView([23.812,90.367],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
    zones.forEach(z=>{if(z.polygon.length>=3)L.polygon(z.polygon,{color:z.color,fillOpacity:0.04,interactive:false}).addTo(map);});
    const group=new L.FeatureGroup().addTo(map);
    if(initial.current.length>=3){const poly=L.polygon(initial.current);group.addLayer(poly);map.fitBounds(poly.getBounds(),{padding:[30,30]});}
    map.addControl(new L.Control.Draw({draw:{polygon:{allowIntersection:false,showArea:false},polyline:false,rectangle:false,circle:false,marker:false,circlemarker:false},edit:{featureGroup:group}}));
    const sync=()=>{let pts:[number,number][]=[];group.eachLayer(layer=>{if(layer instanceof L.Polygon){const coords=layer.getLatLngs()[0] as L.LatLng[];pts=coords.map(p=>[p.lat,p.lng]);}});callback.current(pts);};
    map.on(L.Draw.Event.CREATED,(event)=>{const e=event as L.DrawEvents.Created;group.clearLayers();group.addLayer(e.layer);sync();});
    map.on(L.Draw.Event.EDITED,sync);map.on(L.Draw.Event.DELETED,sync);
    const timer=setTimeout(()=>map.invalidateSize(),200);
    return()=>{clearTimeout(timer);map.remove();};
  },[zones]);
  return <div ref={el} className="h-72 w-full rounded-md border" aria-label="Zone polygon drawing map" />;
}