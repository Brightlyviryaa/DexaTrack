import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { circle, control, divIcon, map, marker, tileLayer, type LatLng, type LeafletMouseEvent } from 'leaflet';
import type { WorkLocation } from './model';
import 'leaflet/dist/leaflet.css';

export type WorkPoint = Pick<WorkLocation, 'latitude' | 'longitude'>;
const jakarta = { latitude: -6.2, longitude: 106.82 };
const tilesUrl = import.meta.env.VITE_WORK_MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function WorkLocationMap({ point, gpsPoint, radius, disabled, onSelect }: {
  point: WorkPoint | null;
  gpsPoint: WorkPoint | null;
  radius: number;
  disabled: boolean;
  onSelect: (point: WorkPoint) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const layers = useRef<{ view: ReturnType<typeof map>; pin: ReturnType<typeof marker>; boundary: ReturnType<typeof circle>; tiles: ReturnType<typeof tileLayer> } | null>(null);
  const [initialPoint] = useState(point);
  const [tileStatus, setTileStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const choose = useEffectEvent((position: LatLng) => {
    if (disabled) return;
    const { lat, lng } = position.wrap();
    onSelect({ latitude: lat, longitude: lng });
  });

  useEffect(() => {
    if (!host.current) return;
    const start = initialPoint ?? jakarta;
    const center: [number, number] = [start.latitude, start.longitude];
    const view = map(host.current, { center, zoom: initialPoint ? 17 : 12, maxZoom: 19, zoomControl: false, scrollWheelZoom: false, doubleClickZoom: false });
    control.zoom({ zoomInTitle: 'Perbesar peta', zoomOutTitle: 'Perkecil peta' }).addTo(view);
    view.attributionControl.setPrefix(false);
    const tiles = tileLayer(tilesUrl, { attribution, maxZoom: 19 });
    let tilesFailed = false;
    tiles.on('loading', () => { tilesFailed = false; });
    tiles.on('tileerror', () => { tilesFailed = true; });
    tiles.on('load', () => setTileStatus(tilesFailed ? 'error' : 'ready'));
    tiles.addTo(view);

    const boundary = circle(center, { interactive: false, color: '#0f766e', weight: 2, fillOpacity: .17 });
    const pin = marker(center, {
      draggable: true,
      keyboard: false,
      icon: divIcon({ className: 'work-map-pin', iconSize: [44, 44], iconAnchor: [22, 38] }),
    });
    pin.on('drag', () => boundary.setLatLng(pin.getLatLng()));
    pin.on('dragend', () => choose(pin.getLatLng()));
    view.on('click', (event: LeafletMouseEvent) => choose(event.latlng));
    view.on('keydown', (event: { originalEvent: KeyboardEvent }) => {
      const key = event.originalEvent;
      if (key.key === 'Enter' && key.target === view.getContainer()) {
        key.preventDefault();
        choose(view.getCenter());
      }
    });
    layers.current = { view, pin, boundary, tiles };
    return () => {
      view.remove();
      layers.current = null;
    };
  }, [initialPoint]);

  useEffect(() => {
    if (!layers.current) return;
    const { view, pin, boundary } = layers.current;
    if (!point) {
      pin.remove();
      boundary.remove();
      return;
    }
    const center: [number, number] = [point.latitude, point.longitude];
    pin.setLatLng(center).addTo(view);
    boundary.setLatLng(center).setRadius(radius).addTo(view);
    if (disabled) pin.dragging?.disable();
    else pin.dragging?.enable();
  }, [point, radius, disabled]);

  useEffect(() => {
    if (gpsPoint) layers.current?.view.setView([gpsPoint.latitude, gpsPoint.longitude], 17);
  }, [gpsPoint]);

  return (
    <div className="work-map">
      <div ref={host} className="work-map-canvas" role="region" aria-label="Peta lokasi kerja" aria-describedby="work-map-help" />
      <p id="work-map-help" className="sr-only">Gunakan tombol panah untuk menggeser peta dan Enter untuk memilih titik tengah.</p>
      {tileStatus === 'loading' && <p className="work-map-tile-status" role="status">Memuat peta…</p>}
      {tileStatus === 'error' && (
        <div className="work-map-retry">
          <p role="status">Sebagian peta gagal dimuat.</p>
          <button type="button" className="employee-secondary" onClick={() => {
            setTileStatus('loading');
            layers.current?.tiles.redraw();
          }}>Muat ulang peta</button>
        </div>
      )}
    </div>
  );
}
