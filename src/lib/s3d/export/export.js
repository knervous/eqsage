import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';

const EPSILON = 1e-5;

function convertBabylonToEngineCoord(x, y, z) {
  return [-x, z, y];
}

class Plane {
  constructor(nx, ny, nz, d) {
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    this.d = d;
  }

  static fromTriangle(v1, v2, v3) {
    // Compute normal from (v2 - v1) x (v3 - v1)
    const ux = v2.x - v1.x;
    const uy = v2.y - v1.y;
    const uz = v2.z - v1.z;

    const vx = v3.x - v1.x;
    const vy = v3.y - v1.y;
    const vz = v3.z - v1.z;

    // Cross
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    // Normalize
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const nnx = nx / length;
    const nny = ny / length;
    const nnz = nz / length;

    // Plane offset d = -(n · v1)
    const d = -(nnx * v1.x + nny * v1.y + nnz * v1.z);

    return new Plane(nnx, nny, nnz, d);
  }

  // For a point p, returns positive => front, negative => back, ~0 => on plane
  distanceToPoint(p) {
    return this.nx * p.x + this.ny * p.y + this.nz * p.z + this.d;
  }
}

class Polygon {
  constructor(vertices) {
    this.vertices = vertices; // Array of { x, y, z } in “engine” coords
    // Precompute plane from first 3 vertices (assuming at least 3)
    if (this.vertices.length >= 3) {
      this.plane = Plane.fromTriangle(
        this.vertices[0],
        this.vertices[1],
        this.vertices[2]
      );
    } else {
      // Degenerate polygon => can store null plane
      this.plane = null;
    }
  }

  /**
   * Computes (and caches) the polygon's own normal for classification
   * We reuse `plane` if it exists, or compute from the first 3 vertices
   */
  getNormal() {
    if (this.plane) {
      return { x: this.plane.nx, y: this.plane.ny, z: this.plane.nz };
    }
    return { x: 0, y: 0, z: 0 };
  }
}

function splitPolygon(
  polygon,
  plane,
  coplanarFront, // Output array for coplanar polygons belonging to the "front" side
  coplanarBack, // Output array for coplanar polygons belonging to the "back" side
  front, // Output array for polygons in front of the plane
  back // Output array for polygons behind the plane
) {
  const vertices = polygon.vertices;
  const vcount = vertices.length;

  // If degenerate
  if (vcount < 3 || !plane) {
    return;
  }

  const classifications = new Array(vcount);
  const frontVerts = [];
  const backVerts = [];
  let onPlaneCount = 0;
  let frontCount = 0;
  let backCount = 0;

  // 1) Classify each vertex
  for (let i = 0; i < vcount; i++) {
    const dist = plane.distanceToPoint(vertices[i]);
    if (dist > EPSILON) {
      classifications[i] = 1; // front
      frontCount++;
    } else if (dist < -EPSILON) {
      classifications[i] = -1; // back
      backCount++;
    } else {
      classifications[i] = 0; // coplanar
      onPlaneCount++;
    }
  }

  // 2) If all are coplanar => put in coplanarFront or coplanarBack
  if (onPlaneCount === vcount) {
    // The entire polygon is coplanar
    // We check the dot product between the plane normal and polygon normal
    const pNormal = polygon.getNormal();
    // plane normal
    const dot =
      plane.nx * pNormal.x + plane.ny * pNormal.y + plane.nz * pNormal.z;

    // If dot >= 0 => treat as "coplanar front"
    // else => "coplanar back"
    if (dot >= 0) {
      coplanarFront.push(polygon);
    } else {
      coplanarBack.push(polygon);
    }
    return;
  }

  // 3) If no vertices in back => entire polygon in front
  if (frontCount === vcount) {
    front.push(polygon);
    return;
  }

  // 4) If no vertices in front => entire polygon in back
  if (backCount === vcount) {
    back.push(polygon);
    return;
  }

  // 5) Otherwise, we have to split
  for (let i = 0; i < vcount; i++) {
    const j = (i + 1) % vcount; // next index
    const vi = vertices[i];
    const vj = vertices[j];
    const ci = classifications[i];
    const cj = classifications[j];

    // Add current vertex to front/back lists if it’s front/back or on-plane
    if (ci >= 0) {
      frontVerts.push(vi);
    }
    if (ci <= 0) {
      backVerts.push(vi);
    }

    // Check if edge crosses plane
    if ((ci > 0 && cj < 0) || (ci < 0 && cj > 0)) {
      // t is ratio along edge (vi->vj)
      const distI = plane.distanceToPoint(vi);
      const distJ = plane.distanceToPoint(vj);
      const t = distI / (distI - distJ);

      // Interpolate
      const vm = {
        x: vi.x + t * (vj.x - vi.x),
        y: vi.y + t * (vj.y - vi.y),
        z: vi.z + t * (vj.z - vi.z),
      };
      // Add this point to both sides
      frontVerts.push(vm);
      backVerts.push(vm);
    }
  }

  // Build new polygons from splitted vertex lists
  if (frontVerts.length >= 3) {
    front.push(new Polygon(frontVerts));
  }
  if (backVerts.length >= 3) {
    back.push(new Polygon(backVerts));
  }
}

export function polygonsFromBabylonMesh(mesh) {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) || [];
  const indices = mesh.getIndices() || [];

  const polygons = [];

  // Each set of 3 indices forms one triangle.
  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i];
    const i2 = indices[i + 1];
    const i3 = indices[i + 2];

    const x1 = positions[i1 * 3 + 0];
    const y1 = positions[i1 * 3 + 1];
    const z1 = positions[i1 * 3 + 2];

    const x2 = positions[i2 * 3 + 0];
    const y2 = positions[i2 * 3 + 1];
    const z2 = positions[i2 * 3 + 2];

    const x3 = positions[i3 * 3 + 0];
    const y3 = positions[i3 * 3 + 1];
    const z3 = positions[i3 * 3 + 2];

    // Convert from Babylon to engine coords
    const [ex1, ey1, ez1] = convertBabylonToEngineCoord(x1, y1, z1);
    const [ex2, ey2, ez2] = convertBabylonToEngineCoord(x2, y2, z2);
    const [ex3, ey3, ez3] = convertBabylonToEngineCoord(x3, y3, z3);

    const tri = new Polygon([
      { x: ex1, y: ey1, z: ez1 },
      { x: ex2, y: ey2, z: ez2 },
      { x: ex3, y: ey3, z: ez3 },
    ]);

    polygons.push(tri);
  }

  return polygons;
}

class BSPNode {
  constructor(polygons) {
    this.plane = null;
    this.front = null;
    this.back = null;
    this.polygons = []; // coplanar polygons

    if (polygons && polygons.length > 0) {
      this.build(polygons);
    }
  }

  build(polygons) {
    // 1) Pick the first polygon’s plane as the node plane
    this.plane = polygons[0].plane;

    // Arrays to collect polygons during splitting
    const coplanarFront = [];
    const coplanarBack = [];
    const frontPolys = [];
    const backPolys = [];

    // 2) Split/classify each polygon
    for (const p of polygons) {
      splitPolygon(
        p,
        this.plane,
        coplanarFront,
        coplanarBack,
        frontPolys,
        backPolys
      );
    }

    // 3) Polygons that are coplanar with this plane => store in this node
    this.polygons.push(...coplanarFront);

    // If you prefer to put coplanarBack into this node as well, you can.
    // Many BSP implementations store back-coplanars in "back."
    // We'll keep it standard and push them into back side:
    if (coplanarBack.length > 0) {
      backPolys.push(...coplanarBack);
    }

    // 4) Recursively build front child
    if (frontPolys.length > 0) {
      this.front = new BSPNode(frontPolys);
    }

    // 5) Recursively build back child
    if (backPolys.length > 0) {
      this.back = new BSPNode(backPolys);
    }
  }
}

export function createBsp(meshes, Regions) {
  const root = buildBSPFromMeshes(meshes);
  return flattenBSP(root, Regions);
}

export function buildBSPFromMeshes(meshes) {
  const allPolygons = [];

  // Gather polygons from each mesh
  for (const mesh of meshes) {
    // Optionally skip Skybox, UI, or other special meshes
    if (!mesh.isVisible || !mesh.getVerticesData) {
      continue;
    }
    const polys = polygonsFromBabylonMesh(mesh);
    allPolygons.push(...polys);
  }

  // Build the BSP
  const root = new BSPNode(allPolygons);
  return root;
}

/**
 * Compute a bounding sphere [cx, cy, cz, r] from a list of polygons.
 * Uses a simple min/max approach.
 */
function computeBoundingSphereFromPolygons(polygons) {
  if (!polygons || polygons.length === 0) {
    return [0, 0, 0, 0];
  }

  // Initialize min/max to large/small values
  let minX = Number.POSITIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY,
    maxZ = Number.NEGATIVE_INFINITY;

  // Expand the bounds for each vertex of each polygon
  for (const poly of polygons) {
    for (const v of poly.vertices) {
      if (v.x < minX) {
        minX = v.x;
      }
      if (v.y < minY) {
        minY = v.y;
      }
      if (v.z < minZ) {
        minZ = v.z;
      }

      if (v.x > maxX) {
        maxX = v.x;
      }
      if (v.y > maxY) {
        maxY = v.y;
      }
      if (v.z > maxZ) {
        maxZ = v.z;
      }
    }
  }

  // Center is midpoint of min & max
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  // Radius is half of the diagonal of the bounding box
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  const diameter = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const radius = diameter / 2;

  return [cx, cy, cz, radius];
}

function pointInsideBox(px, py, pz, minV, maxV) {
  return (
    px >= minV[0] &&
    px <= maxV[0] &&
    py >= minV[1] &&
    py <= maxV[1] &&
    pz >= minV[2] &&
    pz <= maxV[2]
  );
}
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
  [RegionType.Normal]       : '',
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
  const createPaddedNumber = (val, dig) => `${val}`.padStart(dig, '0');
  if (region.regionType === RegionType.Zoneline) {
    const { zoneLineInfo } = region;
    // Construct this piece by piece
    if (zoneLineInfo.type === ZoneLineType.Reference) {
      // What happened to this in client once 255 was reached?
      // id 255 is rujarkian hills
      const reference = '00255';
      return `${prefix}${reference}${createPaddedNumber(
        zoneLineInfo.index,
        6
      )}000000000000000${suffix}`;
    }
    // Construct this a piece at a time
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

function createZonesFromData(sageRegions, Regions) {
  const Zones = [];

  for (let i = 0; i < sageRegions.length; i++) {
    const sageRegion = sageRegions[i];
    const zoneTag = `Z${String(i).padStart(4, '0')}_ZONE`;

    const zoneObj = {
      Tag     : zoneTag,
      Regions : [],
      UserData: createRegionData(sageRegion),
    };

    const minV = sageRegion.minVertex;
    const maxV = sageRegion.maxVertex;

    for (let rIndex = 0; rIndex < Regions.length; rIndex++) {
      const region = Regions[rIndex];
      const [cx, cy, cz] = region.Sphere;

      if (pointInsideBox(cx, cy, cz, minV, maxV)) {
        zoneObj.Regions.push(rIndex);
      }
    }

    Zones.push(zoneObj);
  }

  return Zones;
}

function flattenBSP(root, zoneRegions) {
  const WorldTree = [];
  const Regions = [];
  let regionNumber = 1;
  function recurse(node) {
    if (!node) {
      return 0; // index 0 = no child
    }

    // We'll use 1-based indexing in the WorldTree array
    const thisIndex = WorldTree.length + 1;

    // Extract plane
    let nx = 0,
      ny = 0,
      nz = 0,
      dd = 0;
    if (node.plane) {
      nx = node.plane.nx;
      ny = node.plane.ny;
      nz = node.plane.nz;
      dd = node.plane.d;
    }

    // Check if this is a leaf
    const isLeaf = node.front === null && node.back === null;

    // Possibly create a region tag
    let regionTag = '';
    if (isLeaf && node.polygons && node.polygons.length > 0) {
      // e.g. "R001234"
      const tag = `${regionNumber}`.padStart(6, '0');
      regionTag = `R${tag}`;
      const sphere = computeBoundingSphereFromPolygons(node.polygons);

      // Create a region object
      const regionObj = {
        Tag              : regionTag,
        RegionFog        : 0,
        Gouraud2         : 0,
        EncodedVisibility: 0,
        VisListBytes     : 1,
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
          VisLists: [
            // Going to need { Ranges } here for PVS
          ],
        },
        Sphere      : sphere,
        ReverbVolume: 0,
        ReverbOffset: 0,
        UserData    : '',
        SpriteTag   : `R${regionNumber}_DMSPRITEDEF`,
      };
      regionNumber++;
      Regions.push(regionObj);
    }

    // Add a node in our WorldTree array
    WorldTree.push({
      Normals       : [nx, ny, nz, dd],
      WorldRegionTag: regionTag,
      FrontTree     : 0,
      BackTree      : 0,
      Distance      : 0,
    });

    // Recurse for children
    const frontIndex = recurse(node.front);
    const backIndex = recurse(node.back);

    // Update front/back pointers
    WorldTree[thisIndex - 1].FrontTree = frontIndex;
    WorldTree[thisIndex - 1].BackTree = backIndex;

    return thisIndex;
  }

  recurse(root);
  const Zones = createZonesFromData(zoneRegions, Regions);
  return { WorldTrees: [{ Tag: '', WorldNodes: WorldTree }], Regions, Zones };
}
