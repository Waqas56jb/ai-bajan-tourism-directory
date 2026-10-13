/**
 * Area-level map (Leaflet). Lazy-loaded — Leaflet is only downloaded on pages that show a map.
 *
 * Listings in this preview have no verified coordinates, so markers are placed at the
 * *area* centre (e.g. "Holetown") and grouped, with a clear note. When real coordinates are
 * supplied (`business.coordinates = { lat, lng }`), individual markers are used instead.
 *
 * Tiles: OpenStreetMap by default — fine for development and light use, but the OSM tile
 * policy disallows heavy commercial traffic. Configure VITE_MAP_TILE_URL /
 * VITE_MAP_ATTRIBUTION for a production tile provider.
 */
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { areaByName } from '@/data/destinations';
import { routes } from '@/lib/routes';

const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const BARBADOS_CENTER = [13.17, -59.55];

function pinIcon(label, active = false) {
  const size = label ? 34 : 22;
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${active ? 'map-pin--active' : ''}" style="width:${size}px;height:${size}px">${label ?? ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Keep the view fitted to the current markers as results change. */
function FitToMarkers({ positions, zoom }) {
  const map = useMap();
  const key = positions.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!positions.length) return;
    if (positions.length === 1) map.setView(positions[0], zoom ?? 13);
    else map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, zoom]);
  return null;
}

/** @param {{ businesses: object[], className?: string, zoom?: number, activeSlug?: string, single?: boolean }} props */
export default function BusinessMap({ businesses, className = '', zoom, single = false }) {
  const groups = useMemo(() => {
    const byKey = new Map();
    for (const b of businesses) {
      const exact =
        b.coordinates && Number.isFinite(b.coordinates.lat) && Number.isFinite(b.coordinates.lng);
      const area = areaByName[b.area];
      if (!exact && !area) continue;
      const key = exact ? `b:${b.id}` : `a:${b.area}`;
      const position = exact ? [b.coordinates.lat, b.coordinates.lng] : area.center;
      if (!byKey.has(key)) byKey.set(key, { key, position, exact, area: b.area, items: [] });
      byKey.get(key).items.push(b);
    }
    return [...byKey.values()];
  }, [businesses]);

  const center = groups.length === 1 ? groups[0].position : BARBADOS_CENTER;
  const initialZoom = zoom ?? (groups.length === 1 ? 13 : 10);

  return (
    <div
      className={`relative overflow-hidden rounded-card border border-line bg-sand ${className}`}
    >
      <MapContainer
        center={center}
        zoom={initialZoom}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <FitToMarkers positions={groups.map((g) => g.position)} zoom={zoom} />
        {groups.map((g) => (
          <Marker
            key={g.key}
            position={g.position}
            icon={pinIcon(single ? null : String(g.items.length))}
            title={g.area}
            alt={`${g.items.length} listings in ${g.area}`}
          >
            <Popup>
              <p className="!m-0 text-xs font-bold uppercase tracking-wider text-ocean-700">
                {g.exact ? 'Location' : `${g.area} · general area`}
              </p>
              <ul className="!mt-2 space-y-1.5">
                {g.items.slice(0, 6).map((b) => (
                  <li key={b.id}>
                    <Link
                      to={routes.business(b.slug)}
                      className="font-bold !text-navy hover:underline"
                    >
                      {b.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {g.items.length > 6 && (
                <p className="!mb-0 !mt-2 text-xs text-muted">
                  +{g.items.length - 6} more in this area
                </p>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <p className="pointer-events-none absolute right-3 top-3 z-[400] max-w-[75%] rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy shadow-soft">
        {groups.some((g) => !g.exact)
          ? 'Pins show the general area, not exact addresses.'
          : 'Listing location'}
      </p>
    </div>
  );
}
