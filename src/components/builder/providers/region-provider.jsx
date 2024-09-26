import React, { createContext, useContext, useEffect, useState } from 'react';
import { ZonePointApi } from 'spire-api/api/zone-point-api';

import { useMainContext } from '../../main/context';
import { useZoneBuilderContext } from '../context';
import { useAlertContext } from '../../../context/alerts';
import { UpgradeState } from '../constants';
import { RegionType } from '../../../lib/s3d/bsp/bsp-tree';

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

function nearestHigherMultipleOf10(num) {
  return Math.ceil(num / 10) * 10;
}

export const RegionProvider = ({ children }) => {
  const {
    zone: {
      metadata: { regions },
      projectName,
    },
    updateMetadata,
  } = useZoneBuilderContext();

  const { Spire } = useMainContext();
  const { openAlert } = useAlertContext();
  const name = projectName.replace('.eqs', '');
  const [zonePoints, setZonePonts] = useState([]);
  const [upgradeState, setUpgradeState] = useState(UpgradeState.OK);
  const [upgrader, setUpgrader] = useState({ fn: () => {} });
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!Spire && regions.length) {
      setUpgradeState(UpgradeState.NO_SPIRE);
      return;
    }
    if (regions.filter(r => r.region.regionTypes.some(t => t === RegionType.Zoneline) && !r.upgraded)) {
      setUpgradeState(UpgradeState.NEED_UPGRADE);
    } else {
      setUpgradeState(UpgradeState.OK);
    }
  }, [regions, Spire]);


  useEffect(() => {
    if (!Spire && regions.length) {
      setUpgradeState(UpgradeState.NO_SPIRE);
      return;
    }
    (async () => {
      const queryBuilder = new Spire.SpireQueryBuilder();
      queryBuilder.where('zone', '=', name);
      const zonePointApi = new ZonePointApi(...Spire.SpireApi.cfg());

      const { data: zonePoints } = await zonePointApi.listZonePoints(
        queryBuilder.get()
      );
      console.log('ZP', zonePoints);
      setZonePonts(zonePoints);
      const upgrades = [];
      let needsUpgrade = false;
      let absoluteStartingIndex = zonePoints.reduce(
        (acc, val) => Math.max(acc, nearestHigherMultipleOf10(val.number)),
        ABSOLUTE_BASE
      );
      let referenceStartingIndex = zonePoints.reduce(
        (acc, val) => Math.max(acc, nearestHigherMultipleOf10(val.number)),
        REFERENCE_BASE
      );

      for (const region of regions) {
        // Absolute zone positions - we need to add these explicit zone definitions to the DB
        if (region?.region.zoneLineInfo?.zoneIndex !== undefined) {
          const absIndex = region?.region.zoneLineInfo?.zoneIndex;
          if (absIndex < ATP_ABSOLUTE_BASE || !region.upgraded) {
            const newRegion = {
              ...region,
              region: {
                ...region.region,
                zoneLineInfo: {
                  type : 0,
                  index: absoluteStartingIndex / 10,
                },
              },
              upgraded: true,
            };
            needsUpgrade = true;
            const { x, y, z, zoneIndex, rot } = region.region.zoneLineInfo;
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
                  await zonePointApi
                    .createZonePoint({ zonePoint: newZonePoint })
                    .catch(rej);
                  res(newRegion);
                })
            );
            console.log(
              'Absolute region',
              region,
              'new zone point',
              newZonePoint
            );
            absoluteStartingIndex += 10;
          }
          // Starting point
        } else if (region?.region?.zoneLineInfo?.index !== undefined) {
          // Zone point reference. We need to create a new entry for these
          const numberIndex = region?.region.zoneLineInfo.index;
          if (numberIndex < ATP_BASE || !region.upgraded) {
            needsUpgrade = true;
            const newRegion = {
              ...region,
              region: {
                ...region.region,
                zoneLineInfo: {
                  type : 0,
                  index: referenceStartingIndex / 10,
                },
              },
            };
            const existingZonePoint = zonePoints.find(
              (z) => z.number === numberIndex
            );

            const newZonePoint = {
              ...existingZonePoint,
              id    : undefined,
              number: referenceStartingIndex,
            };
            console.log(
              'Existing zone point for region',
              existingZonePoint,
              region,
              'new zone point',
              newZonePoint
            );
            upgrades.push(
              () =>
                new Promise(async (res, rej) => {
                  await zonePointApi
                    .createZonePoint({ zonePoint: newZonePoint })
                    .catch(rej);
                  res(newRegion);
                })
            );
            referenceStartingIndex += 10;
          }
        } else {
          upgrades.push(() => region);
        }
      }
      if (needsUpgrade) {
        setUpgradeState(UpgradeState.NEED_UPGRADE);
        setUpgrader({
          fn: async () => {
            try {
              const regions = await Promise.all(upgrades.map((f) => f()));
              console.log('Regions', regions);
              await updateMetadata({ regions }, projectName, true);
              openAlert(`Successfully upgraded ${upgrades.length} regions.`);
            } catch (e) {
              openAlert('Error upgrading regions', 'warning');
            } finally {
            }
          },
        });
      } else {
        setUpgradeState(UpgradeState.OK);
      }
    })();
  }, [regions, Spire, name, key, openAlert, updateMetadata, projectName]);
  return (
    <RegionContext.Provider
      value={{
        regionUpgradeState: upgradeState,
        upgrader          : upgrader.fn,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
};
