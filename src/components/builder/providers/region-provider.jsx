import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ZonePointApi } from 'spire-api/api/zone-point-api';

import { useMainContext } from '../../main/context';
import { useAlertContext } from '../../../context/alerts';
import { UpgradeState } from '../constants';
import { RegionType } from '../../../lib/s3d/bsp/bsp-tree';
import { useProject } from '../hooks/metadata';

const initialState = {};
const RegionContext = createContext(initialState);
export const useRegionContext = () => useContext(RegionContext);

// Picking a safe number that is unused by the DB. Highest multiple of 10 number currently is 1000 in peq db.
// Keep these separate to be able to freely pick values for the two without worrying about collision
const REFERENCE_BASE = 2000;
const ABSOLUTE_BASE = 3000;
// EQG defines the region as part of the name in ATP_{number / 10} that refers to number in the zone_points in the DB
const ATP_BASE = REFERENCE_BASE / 10;
const ATP_ABSOLUTE_BASE = ABSOLUTE_BASE / 10;

export const RegionProvider = ({ children }) => {
  const {
    project: { projectName },
    metadata: { regions },
    updateMetadata,
  } = useProject();

  const { Spire } = useMainContext();
  const { openAlert } = useAlertContext();
  const name = projectName.replace('.eqs', '');
  const [zonePoints, setZonePonts] = useState([]);
  const [upgradeState, setUpgradeState] = useState(UpgradeState.OK);
  const [upgrader, setUpgrader] = useState({ fn: () => {} });

  const zonePointApi = useMemo(() => {
    if (!Spire) {
      return null;
    }
    return new ZonePointApi(...Spire.SpireApi.cfg());
  }, [Spire]);

  const listZonePoints = useCallback(async () => {
    const queryBuilder = new Spire.SpireQueryBuilder();
    queryBuilder.where('zone', '=', name);
    const { data: zonePoints } = await zonePointApi.listZonePoints(
      queryBuilder.get()
    );
    return zonePoints.filter(zp => zp.number % 10 === 0).sort((a, b) => a.number < b.number ? -1 : 1);
  }, [zonePointApi, Spire, name]);

  useEffect(() => {
    if (!Spire && regions.length) {
      setUpgradeState(UpgradeState.NO_SPIRE);
      return;
    }
    if (
      regions.filter(
        (r) =>
          r.regionType === RegionType.Zoneline &&
          !r.upgraded
      ).length
    ) {
      setUpgradeState(UpgradeState.NEED_UPGRADE);
    } else {
      setUpgradeState(UpgradeState.OK);
      return;
    }
    let current = true;
    (async () => {
      const zonePoints = await listZonePoints();
      if (!current) {
        return;
      }
      console.log('ZP', zonePoints);
      console.log('Regions', regions);
      setZonePonts(zonePoints);
      const upgrades = [];
      let absoluteStartingIndex = ABSOLUTE_BASE;
      let referenceStartingIndex = REFERENCE_BASE;
      const copyRegions = JSON.parse(JSON.stringify(regions));
      for (const [idx, region] of Object.entries(copyRegions)) {
        // Absolute zone positions - we need to add these explicit zone definitions to the DB
        const zoneLineInfo = region.zoneLineInfo;
        if (zoneLineInfo?.zoneIndex !== undefined) {
          const absIndex = zoneLineInfo?.zoneIndex;
          if (absIndex < ATP_ABSOLUTE_BASE || !region.upgraded) {
            const newNumber = absoluteStartingIndex / 10;
            copyRegions[idx].zoneLineInfo = {
              type : 0,
              index: newNumber,
            };
            copyRegions[idx].upgraded = true;

            const { x, y, z, zoneIndex, rot } = zoneLineInfo;
            const newZonePoint = {
              zone               : name,
              x                  : 0,
              y                  : 0,
              z                  : 0,
              target_x           : -x,
              target_y           : z,
              target_z           : y,
              heading            : rot,
              min_expansion      : -1,
              max_expansion      : -1,
              client_version_mask: 0xffffffff,
              buffer             : 0,
              number             : absoluteStartingIndex,
              target_zone_id     : zoneIndex,
            };
            upgrades.push(
              () =>
                new Promise(async (res, rej) => {
                  if (
                    !zonePoints.some((z) => z.number === newZonePoint.number)
                  ) {
                    await zonePointApi
                      .createZonePoint({ zonePoint: newZonePoint })
                      .catch(rej);
                  }

                  res(region);
                })
            );

            absoluteStartingIndex += 10;
          }
          // Starting point
        } else if (zoneLineInfo?.index !== undefined) {
          // Zone point reference. We need to create a new entry for these
          const numberIndex = zoneLineInfo.index;
          if (numberIndex < ATP_BASE || !region.upgraded) {
            const newNumber = referenceStartingIndex / 10;
            copyRegions[idx].zoneLineInfo = {
              type : 0,
              index: newNumber,
            };
            copyRegions[idx].upgraded = true;

            const existingZonePoint = zonePoints.find(
              (z) => z.number === numberIndex
            );

            const newZonePoint = {
              ...existingZonePoint,
              id    : undefined,
              number: referenceStartingIndex,
              x     : 0,
              y     : 0,
              z     : 0,
            };

            upgrades.push(
              () =>
                new Promise(async (res, rej) => {
                  if (
                    !zonePoints.some((z) => z.number === newZonePoint.number)
                  ) {
                    await zonePointApi
                      .createZonePoint({ zonePoint: newZonePoint })
                      .catch(rej);
                  }
                  res(region);
                })
            );
            referenceStartingIndex += 10;
          }
        } else {
          upgrades.push(() => region);
        }
      }

      setUpgradeState(UpgradeState.NEED_UPGRADE);
      setUpgrader({
        fn: async () => {
          try {
            const regions = await Promise.all(upgrades.map((f) => f()));
            console.log('Regions upgraded', regions);
            updateMetadata((m) => {
              m.regions = regions;
              return m;
            });
            openAlert(`Successfully upgraded ${upgrades.length} regions.`);
          } catch (e) {
            openAlert('Error upgrading regions', 'warning');
          } finally {
          }
        },
      });
    })();

    return () => current = false;
  }, [regions, Spire, name, openAlert, updateMetadata, projectName, listZonePoints, zonePointApi]);
  return (
    <RegionContext.Provider
      value={{
        regionUpgradeState: upgradeState,
        upgrader          : upgrader.fn,
        zonePointApi,
        listZonePoints,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
};
