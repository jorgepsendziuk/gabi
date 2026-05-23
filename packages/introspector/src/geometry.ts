import type { ColumnMeta, TableMeta } from '@gabi/core';

const GEOMETRY_TYPES = new Set([
  'geometry',
  'geography',
  'USER-DEFINED',
]);

const LAT_NAMES = new Set(['lat', 'latitude', 'y', 'coord_y']);
const LON_NAMES = new Set(['lon', 'lng', 'longitude', 'long', 'x', 'coord_x']);

export function isGeometryColumn(udtName: string, dataType: string): boolean {
  const udt = udtName.toLowerCase();
  const dt = dataType.toLowerCase();
  return udt === 'geometry' || udt === 'geography' || dt.includes('geometry');
}

export function detectLatLon(columns: ColumnMeta[]): {
  latitudeColumn?: string;
  longitudeColumn?: string;
} {
  let latitudeColumn: string | undefined;
  let longitudeColumn: string | undefined;

  for (const col of columns) {
    const lower = col.name.toLowerCase();
    if (!latitudeColumn && LAT_NAMES.has(lower)) latitudeColumn = col.name;
    if (!longitudeColumn && LON_NAMES.has(lower)) longitudeColumn = col.name;
  }

  return { latitudeColumn, longitudeColumn };
}

export function enrichTableWithGeo(table: TableMeta): TableMeta {
  const geometryColumn = table.columns.find((c) => c.isGeometry)?.name;
  const { latitudeColumn, longitudeColumn } = detectLatLon(table.columns);

  return {
    ...table,
    geometryColumn,
    latitudeColumn,
    longitudeColumn,
  };
}

export function hasGeoCapability(table: TableMeta): boolean {
  return Boolean(
    table.geometryColumn ||
      (table.latitudeColumn && table.longitudeColumn),
  );
}

export function columnLooksLikeGeometry(udtName: string, dataType: string): boolean {
  return GEOMETRY_TYPES.has(udtName) || isGeometryColumn(udtName, dataType);
}
