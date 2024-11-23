import { GlobalStore } from '../../../state';
import { RegionType } from './bsp-tree';

function deduplicateBoxes(boxes) {
  const uniqueBoxes = new Map();
  boxes.forEach((box) => {
    const key = `${box.minVertex.join(',') }|${ box.maxVertex.join(',') }|${ box.center.join(',') }|${ box.regionType}`;
    if (!uniqueBoxes.has(key)) {
      uniqueBoxes.set(key, box);
    }
  });
  return Array.from(uniqueBoxes.values());
}

let insideBuffer = 20;
  
function isBoxInsideAnother(box1, box2) {
  // Check if box1 is inside box2
  return (
    box1.minVertex.every((value, index) => value + insideBuffer >= box2.minVertex[index]) &&
      box1.maxVertex.every((value, index) => value <= box2.maxVertex[index] + insideBuffer)
  );
}
  
function areBoxesAdjacentAndEqualData(box1, box2) {
  // Compare data properties first to avoid unnecessary geometric calculations
  if (JSON.stringify(box1.zoneLineInfo) !== JSON.stringify(box2.zoneLineInfo) || box1.regionType !== box2.regionType) {
    return false;
  }
    
  // Check if boxes are adjacent. This is a simplified check and assumes
  // that boxes are aligned and only touch along one axis.
  const dx =
      Math.min(box1.maxVertex[0], box2.maxVertex[0]) -
      Math.max(box1.minVertex[0], box2.minVertex[0]);
  const dy =
      Math.min(box1.maxVertex[1], box2.maxVertex[1]) -
      Math.max(box1.minVertex[1], box2.minVertex[1]);
  const dz =
      Math.min(box1.maxVertex[2], box2.maxVertex[2]) -
      Math.max(box1.minVertex[2], box2.minVertex[2]);
  
  // To be adjacent, boxes must touch along one dimension (dx, dy, dz == 0)
  // and overlap in the other two dimensions.
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
  
  // Calculate the center of the merged box
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
  
export async function optimizeBoundingBoxes(boxes) {
  let optimized = false;
  const maxCount = 100000;
  let count = 0;
  GlobalStore.actions.setLoadingTitle('Optimizing Regions');
  const perf = performance.now();

  GlobalStore.actions.setLoadingText(`Running BSP region optimization algorithm with ${maxCount} iterations`);
  await new Promise(res => setTimeout(res, 0));

  // Preprocess these, we don't deal in multiple region types in one region--overlap them.
  boxes = boxes.flatMap(b => {
    const region = b.region;
    delete b.region;
    b = {
      ...b,
      ...region,
    };
    if (b.regionTypes.length === 1) {
      b.regionType = b.regionTypes[0];
      delete b.regionTypes;
      return [b];
    }
    const hasZoneLine = b.regionTypes.includes(RegionType.Zoneline);
    const copies = [];
    for (const t of b.regionTypes) {
      const copy = JSON.parse(JSON.stringify(b));
      copy.regionType = t;
      if (hasZoneLine && t !== RegionType.Zoneline) {
        delete copy.zoneLineInfo;
      }
      delete copy.regionTypes;
      copies.push(copy);
    }
    return copies;
  });
  do {
    optimized = false;
    if (count % 1000 === 0) {
      insideBuffer += 2;
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (areBoxesAdjacentAndEqualData(boxes[i], boxes[j])) {
          const mergedBox = mergeBoxes(boxes[i], boxes[j]);
          boxes.splice(j, 1); // Remove box[j] first since j > i
          boxes.splice(i, 1); // Remove box[i]
          boxes.push(mergedBox); // Add the merged box
          optimized = true;
          break; // Restart the process since boxes array has been modified
        }
      }

      if (optimized || count++ > maxCount) {
        break;
      }
    }
   
  } while (optimized);
  if (count < maxCount) {
    GlobalStore.actions.setLoadingText(`Found optimal BSP region translation with ${maxCount - count} iterations remaining`);
    console.log(`Found optimal BSP region translation with ${maxCount - count} iterations remaining`);
  }
  console.log(`Took ${performance.now() - perf} ms`);
  return deduplicateBoxes(boxes);
}
  


export class AABBNode {
  min = [];
  max = [];
  constructor(min, max, data) {
    this.min = min;
    this.max = max;
    if (data) {
      this.data = data;
    }
  }
}

export function buildAABBTree(nodes) {
  // Helper function to recursively build the tree
  function buildTree(nodeList) {
    // Check if nodeList is empty
    if (nodeList.length === 0) {
      return null;
    }
    if (nodeList.length === 1) {
      return nodeList[0];
    }

    // Find the bounding box that encloses all the nodes
    const min = nodeList[0].min.slice(); // clone the array
    const max = nodeList[0].max.slice();

    for (let i = 1; i < nodeList.length; i++) {
      for (let j = 0; j < 3; j++) {
        min[j] = Math.min(min[j], nodeList[i].min[j]);
        max[j] = Math.max(max[j], nodeList[i].max[j]);
      }
    }

    const currentNode = new AABBNode(min, max);

    // Divide the nodes into two groups based on the longest axis of the bounding box
    const axis = max
      .map((val, i) => val - min[i])
      .indexOf(Math.max(...max.map((val, i) => val - min[i])));

    const sortedNodes = nodeList
      .slice()
      .sort((a, b) => a.min[axis] - b.min[axis]);

    const midpoint = Math.floor(sortedNodes.length / 2);
    const leftNodes = sortedNodes.slice(0, midpoint);
    const rightNodes = sortedNodes.slice(midpoint);

    // Recursively build left and right subtrees
    currentNode.left = buildTree(leftNodes);
    currentNode.right = buildTree(rightNodes);

    // Assign parent for recursion to traverse tree upwards
    // and remember last nodes
    if (currentNode.left) {
      currentNode.left.parent = currentNode;
    }
    if (currentNode.right) {
      currentNode.right.parent = currentNode;
    }

    return currentNode;
  }

  // Start building the tree with the input nodes
  return buildTree(nodes);
}

const testNode = (node, point) => {
  if (!node?.min || !node?.max) {
    return false;
  }
  const { min, max } = node;
  return (
    point.x >= min[0] &&
    point.y >= min[1] &&
    point.z >= min[2] &&
    point.x <= max[0] &&
    point.y <= max[1] &&
    point.z <= max[2]
  );
};

const recurseNodeForRegion = (node, position) => {
  if (testNode(node, position)) {
    if (testNode(node.left, position)) {
      return recurseNodeForRegion(node.left, position);
    } else if (testNode(node.right, position)) {
      return recurseNodeForRegion(node.right, position);
    }
    return node;
  }
  return null;
};

export const recurseTreeFromKnownNode = (node, position) => {
  while (node && !testNode(node, position)) {
    node = node.parent;
  }
  return recurseNodeForRegion(node, position);
};
