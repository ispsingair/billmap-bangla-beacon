import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Collector, Customer, Zone } from "@/lib/data";

type Props = {
  customers: Customer[];
  zones: Zone[];
  collectors: Collector[];
  selectedId: string | null;
  selectedZoneId: string | null;
  showRoutes: boolean;
  focus: { lat: number; lng: number; key: number } | null;
  onSelectCustomer: (id: string) => void;
  onSelectZone: (id: string) => void;
};

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

export default function CustomerMap(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false }).setView([23.812, 90.367], 14);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const colors = { paid: cssVar("--paid"), unpaid: cssVar("--due"), overdue: cssVar("--overdue") };
    const collectorById = new Map(props.collectors.map((c) => [c.id, c]));

    for (const z of props.zones) {
      if (z.polygon.length < 3) continue;
      const sel = props.selectedZoneId === z.id;
      const poly = L.polygon(z.polygon, {
        color: z.color,
        weight: sel ? 3 : 1.5,
        fillOpacity: sel ? 0.14 : 0.05,
        dashArray: sel ? undefined : "4 4",
      })
        .bindTooltip(z.name, { permanent: true, direction: "center", className: "zone-label" })
        .on("click", () => cb.current.onSelectZone(z.id));
      g.addLayer(poly);
    }

    if (props.showRoutes) {
      for (const z of props.zones) {
        const pts = props.customers
          .filter((c) => c.zone_id === z.id && c.status !== "paid")
          .sort((a, b) => a.lng - b.lng || a.lat - b.lat)
          .map((c) => [c.lat, c.lng] as [number, number]);
        if (pts.length < 2) continue;
        const col = z.collector_id ? collectorById.get(z.collector_id)?.color : undefined;
        g.addLayer(L.polyline(pts, { color: col ?? z.color, weight: 2.5, opacity: 0.75, dashArray: "6 6" }));
      }
    }

    for (const c of props.customers) {
      const sel = c.id === props.selectedId;
      const mk = L.circleMarker([c.lat, c.lng], {
        radius: sel ? 11 : 8,
        color: sel ? cssVar("--foreground") : "#ffffff",
        weight: sel ? 3 : 2,
        fillColor: colors[c.status],
        fillOpacity: 1,
      })
        .bindTooltip(c.name, { direction: "top", offset: [0, -8] })
        .on("click", () => cb.current.onSelectCustomer(c.id));
      g.addLayer(mk);
    }

    if (!fitted.current && props.customers.length) {
      fitted.current = true;
      m.fitBounds(L.latLngBounds(props.customers.map((c) => [c.lat, c.lng])), { padding: [40, 40] });
    }
  }, [props.customers, props.zones, props.collectors, props.selectedId, props.selectedZoneId, props.showRoutes]);

  useEffect(() => {
    if (!props.selectedZoneId || !map.current) return;
    const z = props.zones.find((x) => x.id === props.selectedZoneId);
    if (z && z.polygon.length >= 3) map.current.fitBounds(L.latLngBounds(z.polygon), { padding: [30, 30] });
  }, [props.selectedZoneId, props.zones]);

  useEffect(() => {
    if (props.focus && map.current) map.current.flyTo([props.focus.lat, props.focus.lng], 17, { duration: 0.6 });
  }, [props.focus]);

  return <div ref={el} className="h-full w-full" />;
}
