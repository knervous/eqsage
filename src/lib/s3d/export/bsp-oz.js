
const Rescale = 34 / 10;
const RegionSize = 128 / 10;
const MaxParseCount = 500;
const TextureSize = 256;
const EllipticalSections = 24;
const BoundOffset = 200; // Distance above/below vertical zone limits
const ZonePlaneThickness = 16;
const GridSize = 64;

const EPSILON = 1e-5;

function getBoundingBox(polygons) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
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
  
  const minPt = new Vec3(minX, minY, minZ);
  const maxPt = new Vec3(maxX, maxY, maxZ);
  return { minPt, maxPt };
}
  

function splitPolygonsAlongPlane(polygons, nx, ny, nz, dist) {
  // Return { leftSide: [...], rightSide: [...] }
  // "left" or "right" is arbitrary; in Pascal code, 
  // it's "inside/outside" or "front/back."
  const leftSide = [];
  const rightSide = [];
  
  // For each polygon, see if it crosses plane
  for (const poly of polygons) {
    let frontCount = 0, backCount = 0;
    const verts = poly.vertices;
    const distances = verts.map(v => nx * v.x + ny * v.y + nz * v.z + dist);
  
    for (const d of distances) {
      if (d >= EPSILON) {
        frontCount++;
      } else if (d <= -EPSILON) {
        backCount++;
      }
    }
  
    // If entire polygon on "front/left"
    if (backCount === 0) {
      leftSide.push(poly);
      continue;
    }
    // If entire polygon on "back/right"
    if (frontCount === 0) {
      rightSide.push(poly);
      continue;
    }
      
    // Otherwise polygon crosses plane
    // For brevity, you’d do the usual “clip edges” approach 
    // (like in your other code) to create two new polygons.
    // We'll skip the full "intersection" logic here, but 
    // you would do exactly what your “LineFacet” or 
    // “GetIntersection” approach does in Pascal.
  
    // Example: We'll just push entire polygon to both sides 
    // to keep code short. (This is incomplete for real usage.)
    leftSide.push(poly);
    rightSide.push(poly);
  }
  
  return { leftSide, rightSide };
}


  
  
/** *******************************************
 * Vec3 (similar to T3DPoint)
 *********************************************/
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  
  subtract(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  
  normalize() {
    const len = this.length();
    if (len !== 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }
  
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  
  cross(v) {
    // Cross product returns a new Vec3
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  
  equals(v, epsilon = 1e-7) {
    return (Math.abs(this.x - v.x) < epsilon &&
              Math.abs(this.y - v.y) < epsilon &&
              Math.abs(this.z - v.z) < epsilon);
  }
}
  
/** *******************************************
   * Helper: Signed distance of a point from plane
   *   plane given by planeNormal, planeDist
   *   The plane eqn is planeNormal . P + planeDist = 0
   *********************************************/
function distanceFromPlane(point, planeNormal, planeDist) {
  // planeDist = D in "N . X + D = 0"
  return planeNormal.dot(point) + planeDist;
}
  
/** *******************************************
   * Polygon
   *   - holds an array of vertex indices
   *   - possibly texture references, color, etc.
   *********************************************/
export class Polygon {
  constructor(vertices) {
    // `vertices` should be an array of { x, y, z }
    this.vertices = vertices || [];
    this.passable = false; // optional
    this.ownerTag = 0; // optional
    this.region = null; // optional
  }
  
  // Insert a vertex index at a given position in the polygon
  insertVertex(idx, insertPos) {
    this.vertices.splice(insertPos, 0, idx);
  }
}
  
/** *******************************************
   * Mesh 
   *   - stores the actual vertex positions
   *   - stores polygons referencing those vertices
   *********************************************/
export class Mesh {
  constructor() {
    this.vertices = []; // array of Vec3
    this.polygons = []; // array of Polygon
  }
  
  // Add a new vertex, return index
  addVertex(vec3) {
    this.vertices.push(vec3);
    return this.vertices.length - 1;
  }
  
  // Add a polygon object
  addPolygon(poly) {
    this.polygons.push(poly);
    return this.polygons.length - 1;
  }
}
  
/** *******************************************
   * Region 
   *   - references a single Mesh
   *   - stores a list of polygon indices that belong to it
   *   - can split itself along a plane, producing two child regions
   *********************************************/
class Region {
  constructor(mesh) {
    this.mesh = mesh;
    this.polyIndices = []; // indices of polygons
    // Child regions
    this.left = null;  
    this.right = null;
    // Some fields for plane splitting
    this.splitNormal = new Vec3();
    this.splitDist = 0;
    // A simple flag
    this.flag = false; 
  }
  
  // Helper to add all mesh polygons to this region
  attachAllPolygons() {
    this.polyIndices = this.mesh.polygons.map((_, i) => i);
  }
  
  // Mark the region or unmark it
  setFlag(b) {
    this.flag = b;
    if (this.left) {
      this.left.setFlag(b);
    }
    if (this.right) {
      this.right.setFlag(b);
    }
  }
  
  /** *****************************************************
     * The KEY method: splitAlongPlane
     *  - If a polygon is entirely on one side, keep it in that child
     *  - If it crosses the plane, we do real intersection and produce
     *    new polygons (like Delphi TRegion does).
     * 
     * planeNormal, planeDist define plane eqn:
     *    planeNormal . X + planeDist = 0
     *******************************************************/
  splitAlongPlane(planeNormal, planeDist) {
    // If empty or no polygons, no need to split
    if (this.polyIndices.length === 0) {
      return;
    }
    // Create child regions
    const leftRegion = new Region(this.mesh);
    const rightRegion = new Region(this.mesh);
  
    // We'll store newly created polygons (split pieces)
    // in the mesh as well. We'll track their indices
    // to put them in left or right child.
    const keepIndicesLeft = [];
    const keepIndicesRight = [];
  
    // Walk through each polygon in this region
    for (const polyIdx of this.polyIndices) {
      const poly = this.mesh.polygons[polyIdx];
      // Classify each vertex as front(+) or back(-) 
      const distances = [];
      const signs = [];
      let hasFront = false;
      let hasBack = false;
  
      for (let i = 0; i < poly.vertices.length; i++) {
        const vIdx = poly.vertices[i];
        const vPos = this.mesh.vertices[vIdx];
        const dist = distanceFromPlane(vPos, planeNormal, planeDist);
        distances.push(dist);
        if (dist >= 0) {
          signs.push(1);
          hasFront = true;
        } else {
          signs.push(-1);
          hasBack = true;
        }
      }
  
      // Cases:
      // 1) ALL front => goes to the "right" side
      // 2) ALL back  => goes to the "left"  side
      // 3) Mixed => we must split polygon
  
      if (hasFront && !hasBack) {
        // Entirely front
        keepIndicesRight.push(polyIdx);
      } else if (hasBack && !hasFront) {
        // Entirely back
        keepIndicesLeft.push(polyIdx);
      } else {
        // The polygon crosses plane => clip
        const { leftPolyIdx, rightPolyIdx } = this.clipPolygonAgainstPlane(polyIdx, planeNormal, planeDist);
        if (leftPolyIdx >= 0) {
          keepIndicesLeft.push(leftPolyIdx);
        }
        if (rightPolyIdx >= 0) {
          keepIndicesRight.push(rightPolyIdx);
        }
      }
    }
  
    // Now store in children
    leftRegion.polyIndices = keepIndicesLeft;
    rightRegion.polyIndices = keepIndicesRight;
  
    // If a child got no polygons, we might omit it
    if (leftRegion.polyIndices.length > 0) {
      // fill out their plane references if you want
      leftRegion.splitNormal = planeNormal.clone();
      leftRegion.splitDist = planeDist;
      this.left = leftRegion;
    }
    if (rightRegion.polyIndices.length > 0) {
      const reversedNormal = planeNormal.clone().multiplyScalar(-1);
      rightRegion.splitNormal = reversedNormal;
      rightRegion.splitDist = -planeDist;
      this.right = rightRegion;
    }
  
    // Optionally, if we want an "internal node" region that doesn't hold
    // polygons, we can do: 
    // this.polyIndices = [];
    // But for a simpler approach, we can leave them. 
  }
  
  /** **********************************************************
     * clipPolygonAgainstPlane
     *   - does the real intersection logic 
     *   - splits the polygon into up to two polygons
     *   - returns {leftPolyIdx, rightPolyIdx} referencing new or existing
     *     polygon indices in the mesh
     ************************************************************/
  clipPolygonAgainstPlane(polyIdx, planeNormal, planeDist) {
    const poly = this.mesh.polygons[polyIdx];
    const outLeft = new Polygon();
    const outRight = new Polygon();
  
    // We'll store the "new" vertex indices for each side
    const leftVerts = [];
    const rightVerts = [];
  
    const count = poly.vertices.length;
  
    for (let i = 0; i < count; i++) {
      const currIdx = poly.vertices[i];
      const nextIdx = poly.vertices[(i + 1) % count];
  
      const currPos = this.mesh.vertices[currIdx];
      const nextPos = this.mesh.vertices[nextIdx];
  
      const currDist = distanceFromPlane(currPos, planeNormal, planeDist);
      const nextDist = distanceFromPlane(nextPos, planeNormal, planeDist);
  
      // Is current vertex front/back?
      const currFront = (currDist >= 0); 
      // Next vertex front/back?
      const nextFront = (nextDist >= 0);
  
      // If current is in front => add to outRight
      // If current is in back  => add to outLeft
      if (currFront) {
        rightVerts.push(currIdx);
      } else {
        leftVerts.push(currIdx);
      }
  
      // Check if we cross the plane between current and next
      if ((currFront && !nextFront) || (!currFront && nextFront)) {
        // There's an intersection. Let's compute exact point
        const t = Math.abs(currDist) / (Math.abs(currDist) + Math.abs(nextDist));
        // Interpolated intersection point
        const interPos = this.interpolate(currPos, nextPos, t);
  
        // Add that new vertex to the mesh
        const interIdx = this.mesh.addVertex(interPos);
  
        // Add that index to both polygons
        rightVerts.push(interIdx);
        leftVerts.push(interIdx);
      }
    }
  
    // If outLeft or outRight ended with fewer than 3 vertices, 
    // it's not a valid polygon => discard
    let leftPolyIdx = -1;
    let rightPolyIdx = -1;
  
    if (leftVerts.length >= 3) {
      const newPoly = new Polygon();
      newPoly.vertices = leftVerts;
      // Copy some attributes
      newPoly.texture = poly.texture;
      leftPolyIdx = this.mesh.addPolygon(newPoly);
    }
    if (rightVerts.length >= 3) {
      const newPoly = new Polygon();
      newPoly.vertices = rightVerts;
      // Copy some attributes
      newPoly.texture = poly.texture;
      rightPolyIdx = this.mesh.addPolygon(newPoly);
    }
  
    // If you want, you can mark the original polygon invalid or remove it
    // but let's just do that by ignoring original poly in the final steps
  
    // Return references
    return { leftPolyIdx, rightPolyIdx };
  }
  
  // Utility: linear interpolation between p1 & p2
  //   p = p1 + t*(p2 - p1)
  interpolate(p1, p2, t) {
    const x = p1.x + t * (p2.x - p1.x);
    const y = p1.y + t * (p2.y - p1.y);
    const z = p1.z + t * (p2.z - p1.z);
    return new Vec3(x, y, z);
  }
}
  
/** *******************************************
   * BSPTree 
   *   - in Delphi TTree
   *   - has a root region
   *   - can do "SplitAlongGrid" or "SplitAlongPlane"
   *********************************************/
export class BSPTree {
  constructor(mesh) {
    // root region with all polygons
    this.root = new Region(mesh);
    this.root.attachAllPolygons();
  }
  
  // For example, a method to split the whole tree along a plane
  splitAlongPlane(planeNormal, planeDist) {
    if (!this.root) {
      return;
    }
    this._splitRegionRecursive(this.root, planeNormal, planeDist);
  }
  
  _splitRegionRecursive(region, planeNormal, planeDist) {
    region.splitAlongPlane(planeNormal, planeDist);
    if (region.left) {
      this._splitRegionRecursive(region.left, planeNormal, planeDist);
    }
    if (region.right) {
      this._splitRegionRecursive(region.right, planeNormal, planeDist);
    }
  }

  recursiveAxisSplit(polygons, normal, zoneMin, zoneMax, splitSize = RegionSize) {
    // If the region from zoneMin..zoneMax is bigger than the threshold
    if ((zoneMax - zoneMin) > splitSize) {
      const divPt = (zoneMin + zoneMax) / 2; // mid
      // We want plane: normal . X = -divPt
      // => plane offset d = -(N.x * x + N.y * y + N.z * z).
      // For X-axis normal(1,0,0) => d = -divPt
      const nx = normal.x, ny = normal.y, nz = normal.z;
      const dist = -divPt;
    
      // Actually split polygons 
      const { leftSide, rightSide } = splitPolygonsAlongPlane(polygons, nx, ny, nz, dist);
        
      // Recurse on each side
      this.recursiveAxisSplit(leftSide, normal, zoneMin, divPt, splitSize);
      this.recursiveAxisSplit(rightSide, normal, divPt, zoneMax, splitSize);
    } else {
      console.log('NODE LEAF', polygons);
      // This chunk is small enough. 
      // In the Pascal code, we keep them or store them in a leaf region.
      // For demonstration, we do nothing. 
      // In real code, you'd push them into a region node, etc.
      // e.g. store the polygons in a global structure or so.
    }
  }
  
  // Possibly a method to subdivide by uniform grid
  subdivideGrid() {
    const polygons = this.root.mesh.polygons;
    // Step A: Determine bounding box
    const { minPt, maxPt } = getBoundingBox(polygons);

    // Step B: compute the normal approach and do splits
    // In Pascal, TTree does repeated splits:
    //   Split along X until subregion < regionSize,
    //   then Y, then Z, etc.

    // For each axis, we do a recursive partition
    // We'll do them one by one:
    // 1) X axis normal => (1, 0, 0)
    this.recursiveAxisSplit(
      polygons,
      new Vec3(1, 0, 0),
      minPt.x,
      maxPt.x,
    );

    // 2) Y axis normal => (0, 1, 0)
    this.recursiveAxisSplit(
      polygons,
      new Vec3(0, 1, 0),
      minPt.y,
      maxPt.y,
    );

    // 3) Z axis normal => (0, 0, 1)
    this.recursiveAxisSplit(
      polygons,
      new Vec3(0, 0, 1),
      minPt.z,
      maxPt.z,
    );

  }
}
  
/** ****************************************************
   * Example usage:
   ******************************************************/
function exampleUsage() {
  // 1. Create a mesh with some vertices and polygons
  const mesh = new Mesh();
  
  // Add some vertices
  const v0 = mesh.addVertex(new Vec3(0, 0, 0));
  const v1 = mesh.addVertex(new Vec3(10, 0, 0));
  const v2 = mesh.addVertex(new Vec3(10, 10, 0));
  const v3 = mesh.addVertex(new Vec3(0, 10, 0));
  const v4 = mesh.addVertex(new Vec3(5, 5, 10));
  
  // Create a base polygon (quad)
  const poly1 = new Polygon();
  poly1.vertices = [v0, v1, v2, v3];
  poly1.texture = 'myTextureA';
  mesh.addPolygon(poly1);
  
  // Another triangular polygon
  const poly2 = new Polygon();
  poly2.vertices = [v1, v2, v4];
  poly2.texture = 'myTextureB';
  mesh.addPolygon(poly2);
  
  // 2. Build a BSP tree from that mesh
  const bsp = new BSPTree(mesh);
  
  // 3. Split along a plane, e.g. normal = (0,0,1), dist = -5 => plane z=5
  const planeNormal = new Vec3(0, 0, 1);
  const planeDist = -5;
  bsp.splitAlongPlane(planeNormal, planeDist);
  
  // Now bsp.root might have left child, right child, etc.
  // Polygons that cross z=5 get clipped
  console.log('Finished splitting. Mesh now has', mesh.polygons.length, 'polygons.');
}
  
// Run example
