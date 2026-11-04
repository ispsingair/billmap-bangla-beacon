import { useEffect, useId, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCoordinates } from "@/lib/coordinates";

type Props = { lat: string; lng: string; onChange: (lat: string, lng: string) => void };

const icon = L.divIcon({
  className: "",
  html: '<div class="customer-location-pin"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const fmt = (n: number) => n.toFixed(6);

export default function LocationPicker({ lat, lng, onChange }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const active = useRef(false);
  const revision = useRef(0);
  const id = useId();
  const cb = useRef(onChange);
  cb.current = onChange;
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [locating, setLocating] = useState(false);

  const place = (la: number, ln: number, center: boolean) => {
    marker.current?.setLatLng([la, ln]);
    const m = map.current;
    if (center && m) m.setView([la, ln], Math.max(m.getZoom(), 16));
  };

  useEffect(() => {
    if (!el.current) return;
    active.current = true;
    const start = parseCoordinates(lat, lng) ?? { lat: 23.8069, lng: 90.3687 };
    const m = L.map(el.current).setView([start.lat, start.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
    const mk = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(m);
    mk.on("dragend", () => {
      revision.current++;
      const p = mk.getLatLng();
      cb.current(fmt(p.lat), fmt(p.lng));
    });
    m.on("click", (e: L.LeafletMouseEvent) => {
      revision.current++;
      mk.setLatLng(e.latlng);
      cb.current(fmt(e.latlng.lat), fmt(e.latlng.lng));
    });
    map.current = m;
    marker.current = mk;
    // Dialog opens with an animation; recompute size once visible.
    const timers = [50, 300].map((t) => setTimeout(() => m.invalidateSize(), t));
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      active.current = false;
      timers.forEach(clearTimeout);
      ro.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = parseCoordinates(lat, lng);
  useEffect(() => {
    const p = parseCoordinates(lat, lng);
    if (p) marker.current?.setLatLng([p.lat, p.lng]);
  }, [lat, lng]);

  function useCurrent() {
    if (!("geolocation" in navigator)) return setMsg({ text: "This device does not support location.", error: true });
    setLocating(true);
    setMsg(null);
    const requestRevision = revision.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!active.current) return;
        setLocating(false);
        if (requestRevision !== revision.current) return;
        const { latitude, longitude, accuracy } = pos.coords;
        cb.current(fmt(latitude), fmt(longitude));
        place(latitude, longitude, true);
        setMsg({ text: `Location set (accuracy about ${Math.round(accuracy)} m).`, error: false });
      },
      (err) => {
        if (!active.current) return;
        setLocating(false);
        const text =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Allow it in browser settings, or pick on the map."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your position is unavailable right now. Pick on the map or type coordinates."
              : "Getting your location timed out. Try again or pick on the map.";
        setMsg({ text, error: true });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function apply() {
    if (!parsed) return setMsg({ text: "Latitude must be −90 to 90 and longitude −180 to 180.", error: true });
    place(parsed.lat, parsed.lng, true);
    setMsg(null);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={useCurrent} disabled={locating}>
          <Crosshair /> {locating ? "Locating…" : "Use Current Location"}
        </Button>
        <span className="self-center text-xs text-muted-foreground">or tap the map / drag the pin</span>
      </div>
      <div ref={el} aria-label="Customer location map" className="relative z-0 h-56 w-full overflow-hidden rounded-md border" />
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-lat`}>Latitude</Label>
          <Input id={`${id}-lat`} inputMode="decimal" value={lat} onChange={(e) => { revision.current++; onChange(e.target.value, lng); }} aria-invalid={!parsed} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-lng`}>Longitude</Label>
          <Input id={`${id}-lng`} inputMode="decimal" value={lng} onChange={(e) => { revision.current++; onChange(lat, e.target.value); }} aria-invalid={!parsed} />
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={apply}><MapPin /> Apply</Button>
      </div>
      {msg && <p role="status" className={msg.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{msg.text}</p>}
    </div>
  );
}