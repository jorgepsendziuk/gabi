import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: unknown; properties?: Record<string, unknown> }>;
}

export interface GeoMapProps {
  geojson?: GeoFeatureCollection;
  center?: [number, number];
  zoom?: number;
  onBboxChange?: (bbox: [number, number, number, number]) => void;
  className?: string;
}

const SOURCE_ID = 'gabi-geojson';
const LAYER_ID = 'gabi-geojson-fill';

function runWhenStyleReady(map: maplibregl.Map, fn: () => void): void {
  if (map.isStyleLoaded()) {
    fn();
    return;
  }
  map.once('load', fn);
}

function fitMapToPoints(map: maplibregl.Map, geojson: GeoFeatureCollection): void {
  const bounds = new maplibregl.LngLatBounds();
  let hasCoords = false;

  for (const f of geojson.features) {
    const geom = f.geometry as { type?: string; coordinates?: unknown } | null;
    if (geom?.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      const [lng, lat] = geom.coordinates as [number, number];
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        bounds.extend([lng, lat]);
        hasCoords = true;
      }
    }
  }

  if (hasCoords) map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
}

function applyGeojsonToMap(map: maplibregl.Map, geojson: GeoFeatureCollection): void {
  const geoData = geojson as maplibregl.GeoJSONSourceSpecification['data'];
  const existing = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

  if (existing) {
    existing.setData(geoData);
  } else {
    map.addSource(SOURCE_ID, { type: 'geojson', data: geoData });
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 6,
          'circle-color': '#66B000',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#002157',
        },
      });
    }
    fitMapToPoints(map, geojson);
  }
}

export function GeoMap({
  geojson,
  center = [-47.9, -15.8],
  zoom = 4,
  onBboxChange,
  className = 'gabi-geomap',
}: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center,
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    if (onBboxChange) {
      const handler = () => {
        const b = map.getBounds();
        onBboxChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      };
      map.on('moveend', handler);
    }

    map.once('load', () => {
      const data = geojsonRef.current;
      if (data) applyGeojsonToMap(map, data);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      applyGeojsonToMap(map, geojson);
    };

    runWhenStyleReady(map, apply);

    return () => {
      cancelled = true;
      map.off('load', apply);
    };
  }, [geojson]);

  return <div ref={containerRef} className={className} />;
}
