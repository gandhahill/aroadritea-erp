export interface CourierConfig {
  code: string;
  name: string;
}

export const COURIERS: CourierConfig[] = [
  { name: 'JNE Express', code: 'jne' },
  { name: 'POS Indonesia', code: 'pos' },
  { name: 'J&T Express', code: 'jnt' },
  { name: 'J&T Cargo', code: 'jnt_cargo' },
  { name: 'SiCepat Ekspres', code: 'sicepat' },
  { name: 'TIKI', code: 'tiki' },
  { name: 'AnterAja', code: 'anteraja' },
  { name: 'Wahana Express', code: 'wahana' },
  { name: 'Ninja Xpress', code: 'ninja' },
  { name: 'Lion Parcel', code: 'lion' },
  { name: 'PCP Express', code: 'pcp' },
  { name: 'SAP Express', code: 'sap' },
  { name: 'ID Express', code: 'ide' },
];
