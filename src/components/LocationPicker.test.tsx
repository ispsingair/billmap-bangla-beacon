import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const mapHandlers: Record<string, (event: unknown) => void> = {};
  const markerHandlers: Record<string, () => void> = {};
  const marker = { addTo: vi.fn(), on: vi.fn(), setLatLng: vi.fn(), getLatLng: vi.fn() };
  const map = { setView: vi.fn(), on: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn(), getZoom: vi.fn(() => 16) };
  const polygons: { points: unknown; opts: Record<string, unknown>; label?: string }[] = [];
  const group = { addTo: vi.fn(), clearLayers: vi.fn(() => { polygons.length = 0; }), addLayer: vi.fn() };
  return { mapHandlers, markerHandlers, marker, map, polygons, group };
});
vi.mock("leaflet", () => ({ default: {
  divIcon: vi.fn(),
  map: () => mock.map,
  tileLayer: () => ({ addTo: vi.fn() }),
  marker: () => mock.marker,
  layerGroup: () => mock.group,
  latLngBounds: (pts: unknown) => ({ pts }),
  polygon: (points: unknown, opts: Record<string, unknown>) => {
    const rec: { points: unknown; opts: Record<string, unknown>; label?: string } = { points, opts };
    mock.polygons.push(rec);
    return { bindTooltip: (label: string) => { rec.label = label; } };
  },
} }));
import LocationPicker from "./LocationPicker";

function Form() {
  const [coords, setCoords] = useState({ lat: "23.8069", lng: "90.3687" });
  return <LocationPicker {...coords} onChange={(lat, lng) => setCoords({ lat, lng })} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.map.setView.mockReturnValue(mock.map);
  mock.group.addTo.mockReturnValue(mock.group);
  (mock.map as unknown as { fitBounds: unknown }).fitBounds = vi.fn();
  mock.map.on.mockImplementation((event, cb) => { mock.mapHandlers[event] = cb; return mock.map; });
  mock.marker.addTo.mockReturnValue(mock.marker);
  mock.marker.on.mockImplementation((event, cb) => { mock.markerHandlers[event] = cb; return mock.marker; });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Customer location picker", () => {
  it("updates both fields from map clicks and marker dragging", () => {
    render(<Form />);
    act(() => mock.mapHandlers["click"]?.({ latlng: { lat: 23.81, lng: 90.37 } }));
    expect(screen.getByLabelText("Latitude")).toHaveValue("23.810000");
    expect(screen.getByLabelText("Longitude")).toHaveValue("90.370000");
    mock.marker.getLatLng.mockReturnValue({ lat: 23.82, lng: 90.38 });
    act(() => mock.markerHandlers["dragend"]?.());
    expect(screen.getByLabelText("Latitude")).toHaveValue("23.820000");
    expect(screen.getByLabelText("Longitude")).toHaveValue("90.380000");
  });
  it("centers valid manual coordinates and rejects an invalid latitude", () => {
    render(<Form />);
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(mock.map.setView).toHaveBeenLastCalledWith([24, 90.3687], 16);
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "91" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(mock.map.setView).toHaveBeenLastCalledWith([24, 90.3687], 16);
  });
  it.each([1, 2, 3])("handles geolocation error %s inline", (code) => {
    const getCurrentPosition = vi.fn((_success, fail) => fail({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2 }));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    render(<Form />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toHaveValue("23.8069");
  });
  it("uses one-shot location and ignores a late result after manual changes or close", () => {
    let success: ((pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) | undefined;
    const getCurrentPosition = vi.fn((cb) => { success = cb; });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    const { unmount } = render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));
    act(() => success?.({ coords: { latitude: 24, longitude: 91, accuracy: 10 } }));
    expect(screen.getByLabelText("Latitude")).toHaveValue("24.000000");
    expect(screen.getByLabelText("Longitude")).toHaveValue("91.000000");
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "25" } });
    act(() => success?.({ coords: { latitude: 24, longitude: 91, accuracy: 10 } }));
    expect(screen.getByLabelText("Latitude")).toHaveValue("25");
    unmount();
    act(() => success?.({ coords: { latitude: 26, longitude: 92, accuracy: 10 } }));
    expect(mock.map.remove).toHaveBeenCalledTimes(1);
  });

});

describe("Customer location picker zones", () => {
  const sq = (o: number): [number, number][] => [[23.8 + o, 90.3], [23.8 + o, 90.4], [23.9 + o, 90.4], [23.9 + o, 90.3]];
  const zones = [
    { id: "a", name: "Mirpur 10", color: "#f00", polygon: sq(0) },
    { id: "b", name: "Pallabi", color: "#0f0", polygon: sq(0.2) },
    { id: "bad", name: "Broken", color: "#00f", polygon: [[1, 2]] as [number, number][] },
  ];
  it("renders valid zone boundaries with labels, non-interactive, skipping invalid ones", () => {
    render(<LocationPicker lat="" lng="" onChange={() => {}} zones={zones} />);
    expect(mock.polygons.map((p) => p.label)).toEqual(["Mirpur 10", "Pallabi"]);
    expect(mock.polygons.every((p) => p.opts["interactive"] === false)).toBe(true);
    expect((mock.map as unknown as { fitBounds: ReturnType<typeof vi.fn> }).fitBounds).toHaveBeenCalledTimes(1);
  });
  it("highlights the selected zone with a stronger border and fill", () => {
    render(<LocationPicker lat="23.85" lng="90.35" onChange={() => {}} zones={zones} selectedZoneId="b" />);
    const sel = mock.polygons.find((p) => p.label === "Pallabi")!;
    const other = mock.polygons.find((p) => p.label === "Mirpur 10")!;
    expect(sel.opts["weight"]).toBe(4);
    expect(sel.opts["fillOpacity"]).toBe(0.22);
    expect(other.opts["weight"]).toBe(1.5);
    expect((mock.map as unknown as { fitBounds: ReturnType<typeof vi.fn> }).fitBounds).not.toHaveBeenCalled();
  });
  it("shows an empty-zones note when there are none", () => {
    render(<LocationPicker lat="" lng="" onChange={() => {}} zones={[]} />);
    expect(screen.getByText("No service zones to display yet.")).toBeInTheDocument();
  });
});
