import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GeoMap } from '@gabi/ui';
import { apiFetch } from '../lib/api';

export function DynamicMapPage() {
  const { resource } = useParams<{ resource: string }>();
  const [dataSourceId, setDataSourceId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [geojson, setGeojson] = useState<{
    type: 'FeatureCollection';
    features: Array<{ type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }>;
  }>();

  useEffect(() => {
    apiFetch<Array<{ resource: string; dataSourceId: string; label: string }>>(
      '/api/generator/pages',
    ).then((pages) => {
      const p = pages.find((x) => x.resource === resource);
      if (p) {
        setDataSourceId(p.dataSourceId);
        setLabel(p.label);
      }
    });
  }, [resource]);

  useEffect(() => {
    if (!dataSourceId) return;
    apiFetch<{
      type: 'FeatureCollection';
      features: Array<{ type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }>;
    }>(
      `/api/runtime/${dataSourceId}/geojson?pageSize=500`,
    ).then(setGeojson);
  }, [dataSourceId]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{label || 'Mapa'}</h2>
      <GeoMap geojson={geojson} />
      <p className="text-sm text-slate-500 mt-2">
        {geojson?.features.length ?? 0} feições carregadas
      </p>
    </div>
  );
}
