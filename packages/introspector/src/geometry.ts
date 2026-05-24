import type { ColumnMeta, GeoSourceType, TableMeta } from '@gabi/core';

const GEOMETRY_UDT = new Set(['geometry', 'geography']);

const LAT_EXACT = new Set([
  'lat',
  'latitude',
  'latitud',
  'y',
  'coord_y',
  'coordy',
  'northing',
]);

const LON_EXACT = new Set([
  'lon',
  'lng',
  'long',
  'longitude',
  'longitud',
  'x',
  'coord_x',
  'coordx',
  'easting',
]);

const LAT_SUFFIX = /(^|_)(lat|latitude|latitud|coord_y|northing)$/i;
const LON_SUFFIX = /(^|_)(lon|lng|long|longitude|longitud|coord_x|easting)$/i;

const GEOLOCATION_COL = /^_?geolocation$/i;
const GEOPOINT_COL = /geopoint$/i;
const LOCATION_COL = /^(geo_)?location$/i;

export function isGeometryColumn(udtName: string, dataType: string): boolean {
  const udt = udtName.toLowerCase();
  const dt = dataType.toLowerCase();
  return GEOMETRY_UDT.has(udt) || udt === 'geometry' || udt === 'geography' || dt.includes('geometry');
}

function isLatName(name: string): boolean {
  const lower = name.toLowerCase();
  return LAT_EXACT.has(lower) || LAT_SUFFIX.test(name);
}

function isLonName(name: string): boolean {
  const lower = name.toLowerCase();
  return LON_EXACT.has(lower) || LON_SUFFIX.test(name);
}

function prefixBeforeSuffix(name: string, suffixRe: RegExp): string {
  return name.replace(suffixRe, '');
}

/** Detecta par lat/lon por nome exato ou prefixo compartilhado (ex.: gps_lat + gps_lon). */
export function detectLatLon(columns: ColumnMeta[]): {
  latitudeColumn?: string;
  longitudeColumn?: string;
} {
  const latCols = columns.filter((c) => !c.isGeometry && isLatName(c.name));
  const lonCols = columns.filter((c) => !c.isGeometry && isLonName(c.name));

  if (latCols.length === 1 && lonCols.length === 1) {
    return { latitudeColumn: latCols[0]!.name, longitudeColumn: lonCols[0]!.name };
  }

  for (const lat of latCols) {
    const latPrefix = prefixBeforeSuffix(lat.name, LAT_SUFFIX);
    const lon = lonCols.find((l) => {
      const lonPrefix = prefixBeforeSuffix(l.name, LON_SUFFIX);
      if (latPrefix && lonPrefix && latPrefix === lonPrefix) return true;
      if (!latPrefix && !lonPrefix && latCols.length === 1 && lonCols.length === 1) return true;
      return false;
    });
    if (lon) return { latitudeColumn: lat.name, longitudeColumn: lon.name };
  }

  return {};
}

function findGeolocationColumn(columns: ColumnMeta[]): ColumnMeta | undefined {
  return columns.find((c) => GEOLOCATION_COL.test(c.name));
}

function findGeopointColumn(columns: ColumnMeta[]): ColumnMeta | undefined {
  return columns.find((c) => GEOPOINT_COL.test(c.name) && !c.isGeometry);
}

function findLocationColumn(columns: ColumnMeta[]): ColumnMeta | undefined {
  return columns.find(
    (c) => LOCATION_COL.test(c.name) && !c.isGeometry && !GEOPOINT_COL.test(c.name),
  );
}

export interface GeoDetection {
  geometryColumn?: string;
  latitudeColumn?: string;
  longitudeColumn?: string;
  geoSource?: GeoSourceType;
}

export function detectGeoColumns(table: TableMeta): GeoDetection {
  const postgisCol = table.columns.find((c) => c.isGeometry);
  if (postgisCol) {
    return { geometryColumn: postgisCol.name, geoSource: 'postgis' };
  }

  const geoloc = findGeolocationColumn(table.columns);
  if (geoloc) {
    return { geometryColumn: geoloc.name, geoSource: 'geolocation' };
  }

  const geopoint = findGeopointColumn(table.columns);
  if (geopoint) {
    return { geometryColumn: geopoint.name, geoSource: 'geopoint' };
  }

  const latLon = detectLatLon(table.columns);
  if (latLon.latitudeColumn && latLon.longitudeColumn) {
    return { ...latLon, geoSource: 'latlon' };
  }

  const location = findLocationColumn(table.columns);
  if (location) {
    return { geometryColumn: location.name, geoSource: 'geopoint' };
  }

  return {};
}

export function enrichTableWithGeo(table: TableMeta): TableMeta {
  const geo = detectGeoColumns(table);
  const columns = table.columns.map((c) => ({
    ...c,
    isLatitude: c.name === geo.latitudeColumn,
    isLongitude: c.name === geo.longitudeColumn,
  }));

  return {
    ...table,
    columns,
    geometryColumn: geo.geometryColumn,
    latitudeColumn: geo.latitudeColumn,
    longitudeColumn: geo.longitudeColumn,
    geoSource: geo.geoSource,
  };
}

export function hasGeoCapability(table: TableMeta): boolean {
  return Boolean(detectGeoColumns(table).geoSource);
}

export function columnLooksLikeGeometry(udtName: string, dataType: string): boolean {
  return isGeometryColumn(udtName, dataType);
}
