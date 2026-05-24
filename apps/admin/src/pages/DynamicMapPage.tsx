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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    setError('');
    apiFetch<{
      type: 'FeatureCollection';
      features: Array<{ type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }>;
    }>(`/api/runtime/${encodeURIComponent(dataSourceId)}/geojson?pageSize=500`)
      .then(setGeojson)
      .catch((e) => {
        setGeojson(undefined);
        setError(String(e));
      })
      .finally(() => setLoading(false));
  }, [dataSourceId]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{label || 'Mapa'}</h2>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Carregando mapa…</p> : <GeoMap geojson={geojson} />}
      <p className="text-sm text-slate-500 mt-2">
        {geojson?.features.length ?? 0} feições com geometria (máx. 5000 por requisição)
      </p>
    </div>
  );
}
