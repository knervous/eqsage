export interface Zones {
  getZones(): Promise<any>;

  getZoneById(zoneId: number): Promise<any>;

  getZoneByShortName(shortName: string): Promise<any>;

  getZoneLongNameByShortName(shortName: string): Promise<any>;
}
