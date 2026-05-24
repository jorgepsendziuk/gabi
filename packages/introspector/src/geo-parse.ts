import type { GeoSourceType } from '@gabi/core';

export function inferGeoSource(opts: {
  geometryColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
}): GeoSourceType | undefined {
  if (opts.latitudeColumn && opts.longitudeColumn) return 'latlon';
  const col = opts.geometryColumn ?? '';
  if (!col) return undefined;
  if (/geolocation/i.test(col)) return 'geolocation';
  if (/geopoint/i.test(col)) return 'geopoint';
  return 'postgis';
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function pointFromLatLon(lat: number, lon: number): { type: 'Point'; coordinates: [number, number] } {
  return { type: 'Point', coordinates: [lon, lat] };
}

/** ODK geopoint: "lat lon alt accuracy" ou objeto { latitude, longitude }. */
function parseGeopointValue(value: unknown): { type: 'Point'; coordinates: [number, number] } | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const lat = toNumber(o.latitude ?? o.lat ?? o.y);
    const lon = toNumber(o.longitude ?? o.lon ?? o.lng ?? o.long ?? o.x);
    if (lat !== null && lon !== null) return pointFromLatLon(lat, lon);
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return parseGeopointValue(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  const parts = raw.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = toNumber(parts[0]);
  const lon = toNumber(parts[1]);
  if (lat === null || lon === null) return null;
  return pointFromLatLon(lat, lon);
}

/** ODK _geolocation: array [lat,lon,...] ou GeoJSON ou objeto com latitude/longitude. */
function parseGeolocationValue(value: unknown): { type: 'Point'; coordinates: [number, number] } | null {
  if (value === null || value === undefined) return null;

  let parsed: unknown = value;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    try {
      parsed = JSON.parse(s);
    } catch {
      return parseGeopointValue(s);
    }
  }

  if (Array.isArray(parsed)) {
    const lat = toNumber(parsed[0]);
    const lon = toNumber(parsed[1]);
    if (lat !== null && lon !== null) return pointFromLatLon(lat, lon);
    return null;
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    if (o.type === 'Point' && Array.isArray(o.coordinates) && o.coordinates.length >= 2) {
      const lon = toNumber(o.coordinates[0]);
      const lat = toNumber(o.coordinates[1]);
      if (lat !== null && lon !== null) return pointFromLatLon(lat, lon);
    }
    const lat = toNumber(o.latitude ?? o.lat);
    const lon = toNumber(o.longitude ?? o.lon ?? o.lng ?? o.long);
    if (lat !== null && lon !== null) return pointFromLatLon(lat, lon);
  }

  return null;
}

function parsePostgisValue(value: unknown): unknown | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  return value;
}

/** Converte valor de célula em geometria GeoJSON Point (ou geometria PostGIS já em JSON). */
export function parseGeoValue(
  value: unknown,
  source: GeoSourceType,
): unknown | null {
  switch (source) {
    case 'geopoint':
      return parseGeopointValue(value);
    case 'geolocation':
      return parseGeolocationValue(value);
    case 'postgis':
      return parsePostgisValue(value);
    default:
      return null;
  }
}

export function geometryFromRow(
  row: Record<string, unknown>,
  opts: {
    geometryColumn?: string;
    latitudeColumn?: string;
    longitudeColumn?: string;
    geoSource?: GeoSourceType;
  },
): unknown | null {
  const source =
    opts.geoSource ??
    inferGeoSource({
      geometryColumn: opts.geometryColumn,
      latitudeColumn: opts.latitudeColumn,
      longitudeColumn: opts.longitudeColumn,
    });

  if (source === 'latlon' && opts.latitudeColumn && opts.longitudeColumn) {
    const lat = toNumber(row[opts.latitudeColumn]);
    const lon = toNumber(row[opts.longitudeColumn]);
    if (lat !== null && lon !== null) return pointFromLatLon(lat, lon);
    return null;
  }

  if (opts.geometryColumn && source) {
    return parseGeoValue(row[opts.geometryColumn], source);
  }

  return null;
}
