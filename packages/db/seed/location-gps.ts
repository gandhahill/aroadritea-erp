/**
 * Location GPS seed data for attendance check-in validation.
 *
 * Stored through the custom field engine so operators can adjust coordinates
 * later from Settings without a schema change.
 */

export const LOCATION_GPS_FIELDS = [
  {
    key: 'gps_lat',
    name: { id: 'Latitude GPS', en: 'GPS latitude', zh: 'GPS 纬度' },
    displayOrder: 10,
  },
  {
    key: 'gps_lng',
    name: { id: 'Longitude GPS', en: 'GPS longitude', zh: 'GPS 经度' },
    displayOrder: 20,
  },
  {
    key: 'gps_radius_m',
    name: {
      id: 'Radius presensi GPS (meter)',
      en: 'GPS attendance radius (meters)',
      zh: 'GPS 考勤半径（米）',
    },
    displayOrder: 30,
  },
] as const;

export const LOCATION_GPS_VALUES: Record<
  string,
  { gps_lat: number; gps_lng: number; gps_radius_m: number }
> = {
  MLI: { gps_lat: -7.7936683, gps_lng: 110.3658678, gps_radius_m: 150 },
  PLZ: { gps_lat: -7.793006, gps_lng: 110.365981, gps_radius_m: 150 },
};
