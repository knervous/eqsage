export function polygonsFromSpriteDef(dmSpriteDef, idx) {
  const polygons = [];
  for (const face of dmSpriteDef.Faces) {
    const [i1, i2, i3] = face.Triangle;

    const [x1, y1, z1] = dmSpriteDef.Vertices[i1];
    const [x2, y2, z2] = dmSpriteDef.Vertices[i2];
    const [x3, y3, z3] = dmSpriteDef.Vertices[i3];

    const [x, y, z] = dmSpriteDef.CenterOffset;

    const poly = new TPolygon(
      [
        { x: x1 + x, y: y1 + y, z: z1 + z },
        { x: x2 + x, y: y2 + y, z: z2 + z },
        { x: x3 + x, y: y3 + y, z: z3 + z },
      ],
      face.Passable,
      dmSpriteDef.Tag,
      dmSpriteDef.region ? { ...dmSpriteDef.region, idx } : null
    );

    polygons.push(poly);
  }

  return polygons;
}

export function buildMeshFromSpriteDefs(dmSpriteDefs2, onlyRegions = false) {
  const polygons = [];
  let idx = 0;
  for (const spriteDef of dmSpriteDefs2) {
    // const polys = polygonsFromSpriteDef(spriteDef, idx);
    // polygons.push(...polys);
    if (onlyRegions && spriteDef.region) {
      const polys = polygonsFromSpriteDef(spriteDef, idx);
      polygons.push(...polys);
    } else if (!onlyRegions) {
      const polys = polygonsFromSpriteDef(spriteDef, idx);
      polygons.push(...polys);
    }
  
    if (spriteDef.region) {
      idx++;
    }
  }
  return polygons;
}

export function buildBSPFromDmSpriteDef2s(dmSpriteDef2s) {
  const polys = buildMeshFromSpriteDefs(dmSpriteDef2s);
  const bspWhole = new TTree(polys);
  const regionPolys = buildMeshFromSpriteDefs(dmSpriteDef2s, true);
  const bsp = new TTree(regionPolys);
  bsp.root.minPt = bspWhole.root.minPt;
  bsp.root.maxPt = bspWhole.root.maxPt;
  bsp.splitAlongGrid();
  return bsp.root;
}

export function computeBoundingSphereFromBounds(minPt, maxPt) {
  if (!minPt || !maxPt) {
    return [0, 0, 0, 0];
  }

  // Compute the center of the bounding sphere
  const cx = (minPt.x + maxPt.x) / 2;
  const cy = (minPt.y + maxPt.y) / 2;
  const cz = (minPt.z + maxPt.z) / 2;

  // Compute the radius as half the diagonal of the bounding box
  const dx = maxPt.x - minPt.x;
  const dy = maxPt.y - minPt.y;
  const dz = maxPt.z - minPt.z;
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;

  return [cx, cy, cz, radius];
}

export function computeBoundingSphereFromPolygons(polygons) {
  if (!polygons || polygons.length === 0) {
    return [0, 0, 0, 0];
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

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

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  const diameter = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const radius = diameter / 2;

  return [cx, cy, cz, radius];
}

export class TPolygon {
  constructor(vertices = [], passable = false, ownerTag = '', region = null) {
    this.vertices = vertices;
    this.passable = passable;
    this.ownerTag = ownerTag;
    this.region = region;
  }

  insertVertex(idx, insertPos) {
    this.vertices.splice(insertPos, 0, idx);
  }
}

/**
 * Intersect a line segment (curr->next) with plane.
 * Returns a new vertex object { x, y, z }.
 */
function intersectEdgePlane(curr, next, plane) {
  const { normal, dist } = plane;
  const p0 = curr.pos;
  const p1 = next.pos;

  // parametric t for intersection
  const denom = dot(normal, subtract(p1, p0));
  // In degenerate cases, denom could be 0 if line is parallel to plane
  // or if p1 == p0. For now assume not.
  const t = (dist - dot(normal, p0)) / denom;

  return {
    x: p0.x + t * (p1.x - p0.x),
    y: p0.y + t * (p1.y - p0.y),
    z: p0.z + t * (p1.z - p0.z),
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function deduplicateVertices(verts) {
  if (!verts.length) {
    return verts;
  }
  const result = [verts[0]];
  for (let i = 1; i < verts.length; i++) {
    const prev = result[result.length - 1];
    const curr = verts[i];
    // if they're different (or if you want to allow a small epsilon?), push
    if (!pointsAreEqual(prev, curr)) {
      result.push(curr);
    }
  }
  // Optionally check first vs last if you want closed polygons
  if (
    result.length >= 2 &&
    pointsAreEqual(result[0], result[result.length - 1])
  ) {
    result.pop();
  }
  return result;
}

function pointsAreEqual(a, b, eps = 1e-9) {
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.z - b.z) < eps
  );
}

export class TRegion {
  constructor(polygons) {
    this.polygons = polygons ?? [];
    this.left = null;
    this.right = null;

    this.minPt = { x: 0, y: 0, z: 0 };
    this.maxPt = { x: 0, y: 0, z: 0 };
    this.calcBounds();
  }

  get childCount() {
    if (this.left === null && this.right === null) {
      return 0;
    }
    let count = 0;
    if (this.left) {
      count += 1 + this.left.childCount;
    }
    if (this.right) {
      count += 1 + this.right.childCount;
    }
    return count;
  }

  calcBounds() {
    if (this.polygons.length === 0) {
      // When we reassign polygons to children we don't want this to choke and think it has different bounds
      // Allow passing polygons down but don't recalculate as if this box is empty
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const v of this.polygons.flatMap((p) => p.vertices)) {
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

    // Store them back into region
    this.minPt = { x: minX, y: minY, z: minZ };
    this.maxPt = { x: maxX, y: maxY, z: maxZ };
  }

  /**
   *
   * @param {*} minPt
   * @param {*} maxPt
   * @returns {[TRegion]}
   */
  getRegionsInVolume(minPt, maxPt) {
    const found = [];
    function overlaps(r) {
      if (r.maxPt.x < minPt.x) {
        return false;
      }
      if (r.minPt.x > maxPt.x) {
        return false;
      }
      if (r.maxPt.y < minPt.y) {
        return false;
      }
      if (r.minPt.y > maxPt.y) {
        return false;
      }
      if (r.maxPt.z < minPt.z) {
        return false;
      }
      if (r.minPt.z > maxPt.z) {
        return false;
      }
      return true;
    }

    function recurse(region) {
      if (!region) {
        return;
      }
      if (overlaps(region) && region.left === null && region.right === null) {
        found.push(region);
      }
      // Continue down the BSP tree
      recurse(region.left);
      recurse(region.right);
    }

    recurse(this);
    return found;
  }

  getLeafRegionsWithPolygons() {
    const found = [];
    function recurse(region) {
      if (!region) {
        return;
      }
      if (
        region.left === null &&
        region.right === null &&
        region.polygons.length > 0
      ) {
        found.push(region);
      }
      recurse(region.left);
      recurse(region.right);
    }
    recurse(this);
    return found;
  }

  /**
   * Split this region's polygons along a given plane, distributing
   * the new polygons into the 'left' or 'right' child regions.
   *
   * @param {Object} plane       An object { normal: {x,y,z}, dist: number }
   */
  splitAlongPlane(plane, regionDivider = false) {

    if (!this.plane) {
      this.plane = {
        regionDivider
      };
    }
    this.plane.x = plane.normal.x;
    this.plane.y = plane.normal.y;
    this.plane.z = plane.normal.z;
    this.plane.d = plane.dist;

    // We'll accumulate polygons that go into left vs right
    const newLeftPolys = [];
    const newRightPolys = [];

    // For each polygon currently in this region:
    for (const poly of this.polygons) {
      // Split it => we get up to two sub-polygons, each labeled 'left' or 'right'
      const splitted = this.splitPolygonByPlane(poly, plane);

      // Distribute them to left or right
      for (const sp of splitted) {
        if (sp.side === 'left') {
          newLeftPolys.push(sp.poly);
        } else if (sp.side === 'right') {
          newRightPolys.push(sp.poly);
        }
      }
    }
    const leftRegion = new TRegion(newLeftPolys);
    const rightRegion = new TRegion(newRightPolys);
  
    // Calculate the bounds for the left and right regions based on the parent bounding box divided by the plane
    // minPt and maxPt are {x:number, y:number, z:number}
    const parentMin = this.minPt;
    const parentMax = this.maxPt;
  
 
    if (plane.normal.x !== 0) {
      const splitX = plane.dist;
      leftRegion.minPt = { x: parentMin.x, y: parentMin.y, z: parentMin.z };
      leftRegion.maxPt = { x: splitX, y: parentMax.y, z: parentMax.z };
      rightRegion.minPt = { x: splitX, y: parentMin.y, z: parentMin.z };
      rightRegion.maxPt = { x: parentMax.x, y: parentMax.y, z: parentMax.z };
    } else if (plane.normal.y !== 0) {
      const splitY = plane.dist;
      leftRegion.minPt = { x: parentMin.x, y: parentMin.y, z: parentMin.z };
      leftRegion.maxPt = { x: parentMax.x, y: splitY, z: parentMax.z };
      rightRegion.minPt = { x: parentMin.x, y: splitY, z: parentMin.z };
      rightRegion.maxPt = { x: parentMax.x, y: parentMax.y, z: parentMax.z };
    } else if (plane.normal.z !== 0) {
      const splitZ = plane.dist;
      leftRegion.minPt = { x: parentMin.x, y: parentMin.y, z: parentMin.z };
      leftRegion.maxPt = { x: parentMax.x, y: parentMax.y, z: splitZ };
      rightRegion.minPt = { x: parentMin.x, y: parentMin.y, z: splitZ };
      rightRegion.maxPt = { x: parentMax.x, y: parentMax.y, z: parentMax.z };
    }
  
  
    this.left = leftRegion;
    this.right = rightRegion;
    this.polygons = [];
  }

  /**
   * This is for testing a plane to see if the split would split polys into those containing region info and not
   * @param {*} plane
   * @returns
   */
  previewSplitAlongPlane(plane) {
    const newLeftPolys = [];
    const newRightPolys = [];

    // For each polygon currently in this region:
    for (const poly of this.polygons) {
      // Split it => we get up to two sub-polygons, each labeled 'left' or 'right'
      const splitted = this.splitPolygonByPlane(poly, plane);

      // Distribute them to left or right
      for (const sp of splitted) {
        if (sp.side === 'left') {
          newLeftPolys.push(sp.poly);
        } else if (sp.side === 'right') {
          newRightPolys.push(sp.poly);
        }
      }
    }

    return [newLeftPolys, newRightPolys];
  }

  
  splitPolygonByPlane(poly, plane) {
    const { normal, dist } = plane;
    const verts = poly.vertices.map((v) => {
      const s = planeEval(normal, dist, v);
      return { pos: v, sign: s };
    });

    // Classify
    let allLeft = true;
    let allRight = true;
    for (const vt of verts) {
      if (vt.sign < 0) {
        // left side
        allRight = false;
      } else if (vt.sign > 0) {
        // right side
        allLeft = false;
      }
    }

    // Entirely left
    if (allLeft && !allRight) {
      return [{ side: 'left', poly }];
    }
    // Entirely right
    if (allRight && !allLeft) {
      return [{ side: 'right', poly }];
    }
    // Otherwise, do the actual split:
    return this.performActualSplit(verts, poly, plane);
  }

  /**
   * The real "crossing" logic:
   * We create two polygon vertex lists, one for the left side, one for the right side.
   *
   * @param {Array} verts  Array of objects: [{ pos: {x,y,z}, sign:<float> }, ...]
   * @param {TPolygon} poly  The original polygon
   * @param {Object} plane  { normal:{x,y,z}, dist:Number }
   * @returns {Array} An array of up to two objects:
   *     [
   *       { side: "left",  poly: TPolygon(...) },
   *       { side: "right", poly: TPolygon(...) }
   *     ]
   */
  performActualSplit(verts, poly, plane) {
    const leftVerts = [];
    const rightVerts = [];

    for (let i = 0; i < verts.length; i++) {
      const curr = verts[i];
      const next = verts[(i + 1) % verts.length];

      if (curr.sign < 0) {
        leftVerts.push(curr.pos);
      } else if (curr.sign > 0) {
        rightVerts.push(curr.pos);
      } else {
        leftVerts.push(curr.pos);
        rightVerts.push(curr.pos);
      }

      if (
        (curr.sign < 0 && next.sign > 0) ||
        (curr.sign > 0 && next.sign < 0)
      ) {
        const intersectPt = intersectEdgePlane(curr, next, plane);
        leftVerts.push(intersectPt);
        rightVerts.push(intersectPt);
      } else if (curr.sign === 0 && next.sign !== 0) {
      } else if (next.sign === 0 && curr.sign !== 0) {
      }
    }

    const final = [];

    const cleanedLeft = deduplicateVertices(leftVerts);
    const cleanedRight = deduplicateVertices(rightVerts);

    if (cleanedLeft.length >= 3) {
      final.push({
        side: 'left',
        poly: new TPolygon(
          cleanedLeft,
          poly.passable,
          poly.ownerTag,
          poly.region
        ),
      });
    }
    if (cleanedRight.length >= 3) {
      final.push({
        side: 'right',
        poly: new TPolygon(
          cleanedRight,
          poly.passable,
          poly.ownerTag,
          poly.region
        ),
      });
    }

    return final;
  }
}

/**
 * Evaluate plane at point (like "plane equation").
 * plane: { normal: {x, y, z}, dist: number }
 * We treat plane as normal·p - dist = 0
 * => sign = (n.x * p.x + n.y * p.y + n.z * p.z) - dist
 */
function planeEval(normal, dist, point) {
  return normal.x * point.x + normal.y * point.y + normal.z * point.z - dist;
}

/** **********************************************
 * TTree
 *
 *  - The "tree" that owns a root TRegion
 ************************************************/
export class TTree {
  constructor(polys) {
    this.root = new TRegion(polys);
  }

  /**
   * Split the entire tree along a 3D grid, recursively.
   * @param {number} gridSize
   *        The maximum allowed bounding-box size (in x, y, or z). If a region
   *        is bigger than gridSize along any axis, we split it.
   */
  splitAlongGrid(gridSize = 128) {
    // ...
    // let's get the bounding box from the root region
    const dx = this.root.maxPt.x - this.root.minPt.x;
    const dy = this.root.maxPt.y - this.root.minPt.y;
    const dz = this.root.maxPt.z - this.root.minPt.z;

    let splitSize = gridSize;
    const maxAllowedCells = 4096;
    while (
      Math.round(dx / splitSize) *
        Math.round(dy / splitSize) *
        Math.round(dz / splitSize) >
        maxAllowedCells &&
      splitSize < 8192
    ) {
      splitSize = splitSize * 2;
    }
    this._splitAlongGridRec(this.root, splitSize);
  }
  /**
   *
   * @param {TRegion} region
   * @param {number} gridSize
   * @returns
   */
  _splitAlongGridRec(region, gridSize) {

    // 1) Decide if we need a plane split along the largest axis
    const dx = region.maxPt.x - region.minPt.x;
    const dy = region.maxPt.y - region.minPt.y;
    const dz = region.maxPt.z - region.minPt.z;

    let axis = 'x';
    let size = dx;
    if (dy > size) {
      axis = 'y';
      size = dy;
    }
    if (dz > size) {
      axis = 'z';
      size = dz;
    }

    // If largest dimension > gridSize, do a plane-split
    if (size > gridSize) {
      // We'll build a plane at the midpoint on that axis
      const planeNormal = { x: 0, y: 0, z: 0 };
      let planeDist = 0;
      if (axis === 'x') {
        planeNormal.x = 1;
        planeDist = (region.minPt.x + region.maxPt.x) * 0.5;
      } else if (axis === 'y') {
        planeNormal.y = 1;
        planeDist = (region.minPt.y + region.maxPt.y) * 0.5;
      } else {
        // axis === 'z'
        planeNormal.z = 1;
        planeDist = (region.minPt.z + region.maxPt.z) * 0.5;
      }

      // Perform the standard plane-split
      region.splitAlongPlane({ normal: planeNormal, dist: planeDist });

      // Recurse into children to potentially keep splitting
      if (region.left) {
        this._splitAlongGridRec(region.left, gridSize);
      }
      if (region.right) {
        this._splitAlongGridRec(region.right, gridSize);
      }

      return; // We’ve now plane-split this region & handled kids
    }

    // 2) If we get here: this region is small enough in bounding-box terms.
    //    If it already has children for some reason, we just keep going down.
    if (region.left || region.right) {
      // Recurse
      if (region.left) {
        this._splitAlongGridRec(region.left, gridSize);
      }
      if (region.right) {
        this._splitAlongGridRec(region.right, gridSize);
      }
      return;
    }

    // 3) This region is a leaf (no children) and is within gridSize.
    //    Check if polygons are "mixed" (some have region, some do not).
    const hasRegion = region.polygons.some((p) => p.region);
    const hasNoRegion = region.polygons.some((p) => !p.region);

    // If it’s a mix, partition them into two child TRegions:
    if (false && hasRegion && hasNoRegion) {
      // OK in this part I want to split the region into two parts with the best possible plane
      // to separate the two types of polygons -- region and not region.
      // I want this to keep happening until regions area split out into their own leaf nodes.
      console.log('Partition leaf', region);

      const subStack = [[region, 0]];
      while (subStack.length > 0) {
        /**
         * @type {[TRegion, number]}
         */
        const [sub, depth] = subStack.pop();
        if (depth >= 6) {
          continue;
        }
        // Re-check bounding box, in case new polygons were assigned

        // Check if sub-region is still mixed
        const firstEQRegion = sub.polygons.find((p) => p.region);
        const subHasNoReg = sub.polygons.some((p) => !p.region);
        const subHasReg = !!firstEQRegion;

        if (subHasReg && subHasNoReg) {
          // Choose a plane that cuts through the volume here
          const [minX, minY, minZ] = firstEQRegion.region.minVertex;
          const [maxX, maxY, maxZ] = firstEQRegion.region.maxVertex;

          const planes = [
            { normal: { x: 1, y: 0, z: 0 }, dist: minX },
            { normal: { x: -1, y: 0, z: 0 }, dist: -maxX },
            { normal: { x: 0, y: 1, z: 0 }, dist: minY },
            { normal: { x: 0, y: -1, z: 0 }, dist: -maxY },
            { normal: { x: 0, y: 0, z: 1 }, dist: minZ },
            { normal: { x: 0, y: 0, z: -1 }, dist: -maxZ },
          ];
          let plane;
          let bestScore = -Infinity;
          for (const candidate of planes) {
            const [left, right] = sub.previewSplitAlongPlane(candidate);
            const regionPolysInLeft = left.filter((p) => p.region).length;
            const nonRegionPolysInLeft = left.filter((p) => !p.region).length;
            const regionPolysInRight = right.filter((p) => p.region).length;
            const nonRegionPolysInRight = right.filter((p) => !p.region).length;
            if (left.length === 0 || right.length === 0) {
              continue;
            }
            const score =
              Math.abs(regionPolysInLeft - nonRegionPolysInLeft) +
              Math.abs(regionPolysInRight - nonRegionPolysInRight);

            if (score > bestScore) {
              bestScore = score;
              plane = candidate;
            }
          }
          if (plane) {
            sub.splitAlongPlane(plane, true);
            if (sub.left.polygons.length) {
              subStack.push([sub.left, depth + 1]);
            }
            if (sub.right.polygons.length) {
              subStack.push([sub.right, depth + 1]);
            }

          }
       
        }
      }
    }
  }
}
