import { GlobalStore } from '../../../state';
import { RegionType } from './bsp-tree';
// Helper: returns a unique key for a box’s “data” (regionType and zoneLineInfo)
function getBoxDataKey(box) {
  // Assume zoneLineInfo is either null or a small object.
  return `${box.regionType}|${box.zoneLineInfo ? JSON.stringify(box.zoneLineInfo) : 'null'}`;
}

// ----------------------------------------------------------------------------
// Deduplication (unchanged in spirit)
function deduplicateBoxes(boxes) {
  const seen = new Set();
  const unique = [];
  for (const box of boxes) {
    const key = `${box.minVertex.join(',')}|${box.maxVertex.join(',')}|${box.center.join(',')}|${box.regionType}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(box);
    }
  }
  return unique;
}

// ----------------------------------------------------------------------------
// Geometric helpers (same as before)
const insideBuffer = 20;

function isBoxInsideAnother(box1, box2) {
  // Checks if box1 is (roughly) inside box2 using a tolerance.
  return (
    box1.minVertex.every((value, index) => value + insideBuffer >= box2.minVertex[index]) &&
    box1.maxVertex.every((value, index) => value <= box2.maxVertex[index] + insideBuffer)
  );
}
  
function areBoxesAdjacentAndEqualData(box1, box2) {
  // First, compare the “data” properties
  if (
    JSON.stringify(box1.zoneLineInfo) !== JSON.stringify(box2.zoneLineInfo) ||
    box1.regionType !== box2.regionType
  ) {
    return false;
  }
    
  // Check geometric adjacency (or one box inside another)
  const dx =
    Math.min(box1.maxVertex[0], box2.maxVertex[0]) -
    Math.max(box1.minVertex[0], box2.minVertex[0]);
  const dy =
    Math.min(box1.maxVertex[1], box2.maxVertex[1]) -
    Math.max(box1.minVertex[1], box2.minVertex[1]);
  const dz =
    Math.min(box1.maxVertex[2], box2.maxVertex[2]) -
    Math.max(box1.minVertex[2], box2.minVertex[2]);
  
  return (
    isBoxInsideAnother(box1, box2) ||
    (dx === 0 && dy > 0 && dz > 0) ||
    (dy === 0 && dx > 0 && dz > 0) ||
    (dz === 0 && dx > 0 && dy > 0)
  );
}
  
function mergeBoxes(box1, box2) {
  const mergedMinVertex = [
    Math.min(box1.minVertex[0], box2.minVertex[0]),
    Math.min(box1.minVertex[1], box2.minVertex[1]),
    Math.min(box1.minVertex[2], box2.minVertex[2]),
  ];
  const mergedMaxVertex = [
    Math.max(box1.maxVertex[0], box2.maxVertex[0]),
    Math.max(box1.maxVertex[1], box2.maxVertex[1]),
    Math.max(box1.maxVertex[2], box2.maxVertex[2]),
  ];
  const mergedCenter = [
    (mergedMinVertex[0] + mergedMaxVertex[0]) / 2,
    (mergedMinVertex[1] + mergedMaxVertex[1]) / 2,
    (mergedMinVertex[2] + mergedMaxVertex[2]) / 2,
  ];
  
  return {
    minVertex   : mergedMinVertex,
    maxVertex   : mergedMaxVertex,
    center      : mergedCenter,
    regionType  : box1.regionType,
    zoneLineInfo: box1.zoneLineInfo,
  };
}

// ----------------------------------------------------------------------------
// A simple union-find (disjoint-set) implementation
class UnionFind {
  constructor(n) {
    this.parent = new Array(n);
    for (let i = 0; i < n; i++) {
      this.parent[i] = i;
    }
  }
  find(i) {
    if (this.parent[i] !== i) {
      this.parent[i] = this.find(this.parent[i]);
    }
    return this.parent[i];
  }
  union(i, j) {
    const ri = this.find(i);
    const rj = this.find(j);
    if (ri !== rj) {
      this.parent[rj] = ri;
    }
  }
}

// ----------------------------------------------------------------------------
// Optimize bounding boxes using union-find to merge connected regions.
export async function optimizeBoundingBoxes(boxes) {
  // Preprocess: update boxes with region data. (This is similar to your code.)
  boxes = boxes.flatMap(b => {
    const region = b.region;
    delete b.region;
    b = { ...b, ...region };
    if (b.regionTypes.length === 1) {
      b.regionType = b.regionTypes[0];
      delete b.regionTypes;
      return [b];
    }
    const hasZoneLine = b.regionTypes.includes(RegionType.Zoneline);
    return b.regionTypes.map(t => {
      // For a deep clone, you could use JSON.parse(JSON.stringify(b)) if needed.
      const copy = { ...b };
      if (hasZoneLine && t !== RegionType.Zoneline) {
        delete copy.zoneLineInfo;
      }
      copy.regionType = t;
      delete copy.regionTypes;
      return copy;
    });
  });

  GlobalStore.actions.setLoadingTitle('Optimizing Regions');
  GlobalStore.actions.setLoadingText('Running BSP region optimization algorithm...');
  const startTime = performance.now();
  await new Promise(res => setTimeout(res, 0));

  // Group boxes by their “data” properties to avoid cross–group comparisons.
  const groups = new Map();
  for (const box of boxes) {
    const key = getBoxDataKey(box);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(box);
  }

  const mergedBoxes = [];
  // Process each group separately.
  for (const group of groups.values()) {
    const n = group.length;
    if (n === 0) {
      continue;
    }
    const uf = new UnionFind(n);

    // Check each pair (only one order is needed, but because
    // isBoxInsideAnother isn’t symmetric we check both directions).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (
          areBoxesAdjacentAndEqualData(group[i], group[j]) ||
          areBoxesAdjacentAndEqualData(group[j], group[i])
        ) {
          uf.union(i, j);
        }
      }
    }

    // Gather boxes in each connected component.
    const compMap = new Map();
    for (let i = 0; i < n; i++) {
      const root = uf.find(i);
      if (!compMap.has(root)) {
        compMap.set(root, []);
      }
      compMap.get(root).push(group[i]);
    }

    // Merge each component into a single box.
    for (const comp of compMap.values()) {
      let merged = comp[0];
      for (let i = 1; i < comp.length; i++) {
        merged = mergeBoxes(merged, comp[i]);
      }
      mergedBoxes.push(merged);
    }
  }

  console.log(`Optimization took ${performance.now() - startTime} ms`);
  return deduplicateBoxes(mergedBoxes);
}
