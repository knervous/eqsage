export function polygonsFromSpriteDef(dmSpriteDef, idx, defaultTag) {
  const polygons = [];
  for (const face of dmSpriteDef.Faces) {
    const [i1, i2, i3] = face.Triangle;

    const [x1, y1, z1] = dmSpriteDef.Vertices[i1];
    const [x2, y2, z2] = dmSpriteDef.Vertices[i2];
    const [x3, y3, z3] = dmSpriteDef.Vertices[i3];

    const [x, y, z] = dmSpriteDef.CenterOffset;
    if (dmSpriteDef.region) {
      dmSpriteDef.region.idx = idx;
    }
    const poly = new TPolygon(
      [
        { x: x1 + x, y: y1 + y, z: z1 + z },
        { x: x2 + x, y: y2 + y, z: z2 + z },
        { x: x3 + x, y: y3 + y, z: z3 + z },
      ],
      face.Passable,
      dmSpriteDef.A_originalMesh === 'box' ? defaultTag : dmSpriteDef.Tag
    );
    polygons.push(poly);
  }

  return polygons;
}

export function buildMeshFromSpriteDefs(dmSpriteDefs2) {
  const polygons = [];
  let idx = 0;
  console.log('DM', dmSpriteDefs2);
  for (const spriteDef of dmSpriteDefs2) {
    if (spriteDef.region) {
      idx++;
    }
    const polys = polygonsFromSpriteDef(spriteDef, idx, dmSpriteDefs2.find(d => d.A_originalMesh !== 'box').Tag);
    if (spriteDef.region) {
      console.log('Reg');
      polys.forEach(p => {
        p.regions = [spriteDef.region];
        p.passable = false;
      });
    }
    polygons.push(...polys);

  }
  return polygons;
}

export function buildBSPFromDmSpriteDef2s(dmSpriteDef2s, regions) {
  const polys = buildMeshFromSpriteDefs(dmSpriteDef2s, regions);
  const bsp = new TTree(polys, regions);

  bsp.splitAlongGrid(64);
  bsp.clipLeafNodesByRegions();

  console.log('BSP', bsp);

  return bsp.root;
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
  regions = [];
  constructor(
    vertices = [],
    passable = false,
    ownerTag = '',
    regions = [],
    flag = false
  ) {
    this.vertices = vertices;
    this.passable = passable;
    this.ownerTag = ownerTag;
    this.regions = regions;
    this.flag = flag;
  }
  clearRegions() {
    this.regions = [];
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
  }

  get childCount() {
    if (this.isLeafNode) {
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

  get isLeafNode() {
    return this.left === null && this.right === null;
  }

  getAllNodes() {
    const nodes = [this];
    const recurse = (node) => {
      if (node.left) {
        nodes.push(node.left);
        recurse(node.right);
      }
      if (node.right) {
        nodes.push(node.right);
        recurse(node.right);
      }
    }; 
    recurse(this);
    return nodes;
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
   * Split this region's polygons along a given plane, distributing
   * the new polygons into the 'left' or 'right' child regions.
   *
   * @param {Object} plane       An object { normal: {x,y,z}, dist: number }
   */
  splitAlongPlane(plane, regionDivider = false) {
    if (this.left && this.right) {
      const leftSplit = this.left.splitAlongPlane(plane, regionDivider);
      const rightSplit = this.right.splitAlongPlane(plane, regionDivider);
      return leftSplit || rightSplit;
    }
    // We'll accumulate polygons that go into left vs right
    const newLeftPolys = [];
    const newRightPolys = [];
    // console.log('Poly', [...this.polygons]);
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

    // In this case we failed to split geometry so revert back to a leaf node.
    if (newLeftPolys.length === 0 || newRightPolys.length === 0) {
      return false;
    }

    // Region dividers MUST split regions into one side completely otherwise we discard this split
    if (regionDivider) {
      if (!newLeftPolys.some(p => p.regions.includes(regionDivider)) && 
        !newRightPolys.some(p => p.regions.includes(regionDivider))) {
        return false;
      } 
    }

    if (!this.left) {
      this.left = new TRegion();
    }
    if (!this.right) {
      this.right = new TRegion();
    }

    this.plane = {
      regionDivider,
    };

    this.plane.x = plane.normal.x;
    this.plane.y = plane.normal.y;
    this.plane.z = plane.normal.z;
    this.plane.d = plane.dist;

    // Place those polygons in the child regions
    this.left.polygons = this.left.polygons.concat(newLeftPolys);
    this.right.polygons = this.right.polygons.concat(newRightPolys);
    this.left.calcBounds();
    this.right.calcBounds();
    this.polygons = [];

    return true;
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

      const nextSign = next.sign;
      const crossLeftRight =
        (curr.sign < -EPSILON && nextSign > EPSILON) ||
        (curr.sign > EPSILON && nextSign < -EPSILON);
  
      if (crossLeftRight) {
        const intersectPt = intersectEdgePlane(curr, next, plane);
        leftVerts.push(intersectPt);
        rightVerts.push(intersectPt);
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
          poly.regions
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
          poly.regions
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
const EPSILON = 1e-7;

function planeEval(normal, dist, point) {
  const val = normal.x * point.x + normal.y * point.y + normal.z * point.z - dist;
  if (Math.abs(val) < EPSILON) {
    return 0; // treat as on-plane
  }
  return val;
}
/** **********************************************
 * TTree
 *
 *  - The "tree" that owns a root TRegion
 ************************************************/
export class TTree {
  constructor(polys, regions) {
    this.root = new TRegion(polys);
    this.root.calcBounds();
    let idx = 0;
    for (const region of regions) {
      region.idx = idx++;
    }
    this.regions = regions;
  }

  clipLeafNodesByRegions() {
    for (const eqRegion of this.regions) {
      
      // Extract bounding box
      let [minX, minZ, minY] = eqRegion.minVertex;
      let [maxX, maxZ, maxY] = eqRegion.maxVertex;
      const push = 1.0;
      minX += push;
      minZ += push;
      minY += push;
      maxX -= push;
      maxZ -= push;
      maxY -= push;
      const planes = [
        { normal: { x: +1, y: 0, z: 0 }, dist: minX }, // x >= minX
        { normal: { x: -1, y: 0, z: 0 }, dist: -maxX }, // x <= maxX
        { normal: { x: 0, y: +1, z: 0 }, dist: minY }, // y >= minY
        { normal: { x: 0, y: -1, z: 0 }, dist: -maxY }, // y <= maxY
        { normal: { x: 0, y: 0, z: +1 }, dist: minZ }, // z >= minZ
        { normal: { x: 0, y: 0, z: -1 }, dist: -maxZ }, // z <= maxZ
      ];
  

      for (let i = 0; i < planes.length; i++) {
        const plane = planes[i];
        plane.regionDivider = eqRegion;
        this.root.splitAlongPlane(plane, eqRegion);
      }
    }
  }
  /**
   * Split the entire tree along a 3D grid, recursively.
   * @param {number} gridSize
   *        The maximum allowed bounding-box size (in x, y, or z). If a region
   *        is bigger than gridSize along any axis, we split it.
   */
  splitAlongGrid(gridSize = 256) {
    // ...
    // let's get the bounding box from the root region
    this.root.calcBounds();
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
    // Always recalc bounding box
    region.calcBounds();

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
    }
  }
}
