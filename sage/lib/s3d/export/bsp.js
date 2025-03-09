import {
  buildBSPFromDmSpriteDef2s,
  computeBoundingSphereFromPolygons,
} from './openzone';

export const RegionType = {
  Normal       : 0,
  Water        : 1,
  Lava         : 2,
  Pvp          : 3,
  Zoneline     : 4,
  WaterBlockLOS: 5,
  FreezingWater: 6,
  Slippery     : 7,
  Unknown      : 8,
};

export const ZoneLineType = {
  Reference: 0,
  Absolute : 1,
};

const RegionTypePrefixMap = {
  [RegionType.Water]        : 'WTN__',
  [RegionType.Lava]         : 'LAN__',
  [RegionType.Pvp]          : 'DRP__',
  [RegionType.Zoneline]     : 'DRNTP',
  [RegionType.WaterBlockLOS]: 'SLN__',
  [RegionType.FreezingWater]: 'VWN__',
  [RegionType.Slippery]     : 'DRN__',
  [RegionType.Normal]       : 'DRN__',
};

function createRegionData(region) {
  const prefix =
    RegionTypePrefixMap[region.regionType] ??
    RegionTypePrefixMap[RegionType.Normal];
  const suffix = '___000000000000\x00';
  const createPaddedNumber = (val, dig) => {
    const neg = val < 0;
    let retVal = Math.abs(val);
    retVal = `${retVal}`.padStart(dig, '0');
    if (neg) {
      retVal = `-${retVal.slice(1)}`;
    }
    return retVal;
  };
  if (region.regionType === RegionType.Zoneline) {
    const { zoneLineInfo } = region;
    if (zoneLineInfo.type === ZoneLineType.Reference) {
      const reference = '00255';
      return `${prefix}${reference}${createPaddedNumber(
        zoneLineInfo.index * 10,
        6
      )}000000000000000${suffix}`;
    }
    let userData = prefix;
    userData += createPaddedNumber(zoneLineInfo.zoneIndex, 5);
    userData += createPaddedNumber(zoneLineInfo.x, 6);
    userData += createPaddedNumber(zoneLineInfo.y, 6);
    userData += createPaddedNumber(zoneLineInfo.z, 6);
    userData += createPaddedNumber(zoneLineInfo.rot, 3);
    return `${userData}${suffix}`;
  }
  return `${prefix}00000000000000000000000000${suffix}`;
}

function addOrCreateRegion(Zones, region, bspRegionIdx) {
  const zoneTag = `Z${String(region.idx).padStart(4, '0')}_ZONE`;
  let existingZone = Zones.find((z) => z.Tag === zoneTag);
  if (!existingZone) {
    existingZone = {
      Tag     : zoneTag,
      Regions : [],
      UserData: createRegionData(region),
    };
    Zones.push(existingZone);
  }
  existingZone.Regions.push(bspRegionIdx);
}

function encodeVisRegionsRLE(regions) {
  if (!regions || regions.length === 0) {
    return new Uint8Array(0);
  }

  // Sort ascending
  regions = regions.slice().sort((a, b) => a - b);

  // Determine max ID
  const maxRegionID = regions[regions.length - 1];

  const groups = [];
  let currentRegion = 1;
  let groupStart = 1;
  let visible = regions[0] === currentRegion;
  let idx = 0;

  while (currentRegion <= maxRegionID) {
    let isVisible = false;
    if (idx < regions.length && regions[idx] === currentRegion) {
      isVisible = true;
      idx++;
    }

    if (isVisible !== visible) {
      groups.push({ visible, count: currentRegion - groupStart });
      visible = isVisible;
      groupStart = currentRegion;
    }
    currentRegion++;
  }

  groups.push({ visible, count: currentRegion - groupStart });

  // Convert groups => outBytes
  const outBytes = [];
  for (let g = 0; g < groups.length; g++) {
    const { visible, count } = groups[g];
    if (count <= 0) {
      continue;
    }

    if (visible) {
      if (
        g + 1 < groups.length &&
        !groups[g + 1].visible &&
        count <= 7 &&
        groups[g + 1].count <= 7
      ) {
        // Combine visible + next not-visible, each up to 7
        const combinedByte = 0x80 | (count << 3) | (groups[g + 1].count & 0x07);
        outBytes.push(combinedByte);
        g++;
      } else if (count <= 62) {
        outBytes.push(0xc0 + count);
      } else {
        outBytes.push(0xff);
        outBytes.push(count & 0xff, (count >> 8) & 0xff);
      }
    } else {
      if (
        g + 1 < groups.length &&
        groups[g + 1].visible &&
        count <= 7 &&
        groups[g + 1].count <= 7
      ) {
        const combinedByte = 0x40 | (count << 3) | (groups[g + 1].count & 0x07);
        outBytes.push(combinedByte);
        g++;
      } else if (count <= 62) {
        outBytes.push(count);
      } else {
        outBytes.push(0x3f);
        outBytes.push(count & 0xff, (count >> 8) & 0xff);
      }
    }
  }

  return new Uint8Array(outBytes);
}

function toBase64(byteArray) {
  let binary = '';
  for (let i = 0; i < byteArray.length; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  return btoa(binary);
}
function assignVisibilityByDistance(Regions, maxDistance = 500) {
  for (let i = 0; i < Regions.length; i++) {
    const rA = Regions[i];
    const [ax, ay, az] = rA.Sphere;
    const visibleList = [];

    for (let j = 0; j < Regions.length; j++) {
      if (j === i) {
        continue;
      } // skip self
      const rB = Regions[j];
      const [bx, by, bz] = rB.Sphere;
      const dist = distance3D(ax, ay, az, bx, by, bz);

      if (dist <= maxDistance) {
        const otherRegionID = j + 1;
        visibleList.push(otherRegionID);
      }
    }

    rA.VisListBytes = 1;
    const rleBytes = encodeVisRegionsRLE(visibleList);
    const base64Ranges = toBase64(rleBytes);
    rA.VisTree.VisLists[0].Ranges = base64Ranges;
  }
}

function distance3D(ax, ay, az, bx, by, bz) {
  const dx = ax - bx,
    dy = ay - by,
    dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function flattenBSP(root) {
  const WorldTree = [];
  const Regions = [];
  const Zones = [];
  let regionNumber = 1;
  const trackedOwners = [];
  function recurse(node) {
    if (!node) {
      return 0;
    }
    // 1-based index, this is intentional
    const thisIndex = WorldTree.length + 1;

    // If plane is null => leaf or empty
    let nx = 0,
      ny = 0,
      nz = 0,
      dd = 0;
    let regionDivider;
    if (node.plane) {
      nx = node.plane.x;
      ny = node.plane.y;
      nz = node.plane.z;
      dd = node.plane.d;
      regionDivider = node.plane.regionDivider;
    }

    // Check if leaf
    const isLeaf =
      !node.left && !node.right && node.polygons && node.polygons.length > 0;

    let regionTag = '';


    if (isLeaf) {
      const owners = [];
      for (const p of node.polygons) {
        if (!owners.includes(p.ownerTag)) {
          owners.push(p.ownerTag);
        }
      }
  
      const ownerTag = owners.find(oTag => !trackedOwners.includes(oTag)) ?? owners[0];

      const tag = `${regionNumber}`.padStart(6, '0');
      regionTag = `R${tag}`;

      const sphere = computeBoundingSphereFromPolygons(node.polygons);
      if (!trackedOwners.includes(ownerTag)) {
        trackedOwners.push(ownerTag);
      }
      const associatedRegions = Array.from(
        new Set(node.polygons.flatMap((p) => p.regions))
      );

      if (associatedRegions.length) {
        for (const region of associatedRegions) {
          addOrCreateRegion(Zones, region, regionNumber - 1);
        }
      }
      const regionObj = {
        Tag              : regionTag,
        RegionFog        : 0,
        Gouraud2         : 0,
        EncodedVisibility: 0,
        VisListBytes     : 0,
        AmbientLightTag  : '',
        RegionVertices   : null,
        RenderVertices   : null,
        Walls            : null,
        Obstacles        : null,
        CuttingObstacles : null,
        VisTree          : {
          VisNodes: [
            {
              Normal      : [0, 0, 0, 0],
              VisListIndex: 1,
              FrontTree   : 0,
              BackTree    : 0,
            },
          ],
          VisLists: [{ Ranges: '' }],
        },
        Sphere      : sphere,
        ReverbVolume: 0,
        ReverbOffset: 0,
        UserData    : '',
        SpriteTag   : ownerTag,
        // Debug info
        polygons    : associatedRegions.length ? node.polygons : null,
        node,
      };

      regionNumber++;
      Regions.push(regionObj);
    }

    WorldTree.push({
      Normals       : [-nx, -ny, -nz, dd],
      WorldRegionTag: regionTag,
      FrontTree     : 0,
      BackTree      : 0,
      Distance      : 0,
      regionDivider,
      node
    });

    const frontIndex = recurse(node.left);
    const backIndex = recurse(node.right);

    WorldTree[thisIndex - 1].FrontTree = frontIndex;
    WorldTree[thisIndex - 1].BackTree = backIndex;
    return thisIndex;
  }

  recurse(root);
  return { WorldTrees: [{ Tag: '', WorldNodes: WorldTree }], Regions, Zones };
}

export function createBsp(dmSpriteDef2s, regions, distance = 500) {
  const root = buildBSPFromDmSpriteDef2s(dmSpriteDef2s, regions);
  window.bsp = root;
  const { WorldTrees, Regions, Zones } = flattenBSP(root, dmSpriteDef2s);
  assignVisibilityByDistance(Regions, distance);
  return { WorldTrees, Regions, Zones };
}
