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

export function GeoMap({
  geojson,
  center = [-47.9, -15.8],
  zoom = 4,
  onBboxChange,
  className = 'gabi-geomap',
}: GeoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    const sourceId = 'gabi-geojson';
    const layerId = 'gabi-geojson-fill';

    const geoData = geojson as maplibregl.GeoJSONSourceSpecification['data'];
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geoData);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geoData });
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#66B000',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#002157',
        },
      });

      const bounds = new maplibregl.LngLatBounds();
      let hasCoords = false;
      for (const f of geojson.features) {
        const geom = f.geometry as { type?: string; coordinates?: [number, number] } | null;
        if (geom?.type === 'Point' && geom.coordinates) {
          const [lng, lat] = geom.coordinates;
          bounds.extend([lng, lat]);
          hasCoords = true;
        }
      }
      if (hasCoords) map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
    }
  }, [geojson]);

  return <div ref={containerRef} className={className} />;
}
