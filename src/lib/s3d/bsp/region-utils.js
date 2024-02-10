
function areBoxesEqual(box1, box2) {
  // Check if minVertex, maxVertex, and center are the same for two boxes
  return (
    box1.minVertex.every((value, index) => value === box2.minVertex[index]) &&
      box1.maxVertex.every((value, index) => value === box2.maxVertex[index]) &&
      box1.center.every((value, index) => value === box2.center[index])
  );
}
  
function deduplicateBoxes(boxes) {
  return boxes.reduce((acc, currentBox) => {
    // Check if currentBox is already in the accumulator based on areBoxesEqual comparison
    const isDuplicate = acc.some((box) => areBoxesEqual(box, currentBox));
    if (!isDuplicate) {
      acc.push(currentBox);
    }
    return acc;
  }, []);
}
  
function isBoxInsideAnother(box1, box2) {
  // Check if box1 is inside box2
  return (
    box1.minVertex.every((value, index) => value >= box2.minVertex[index]) &&
      box1.maxVertex.every((value, index) => value <= box2.maxVertex[index])
  );
}
  
function areBoxesAdjacentAndEqualData(box1, box2) {
  // Compare data properties first to avoid unnecessary geometric calculations
  if (JSON.stringify(box1.region) !== JSON.stringify(box2.region)) {
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
    minVertex: mergedMinVertex,
    maxVertex: mergedMaxVertex,
    center   : mergedCenter,
    region   : box1.region, // Assuming data is the same, use box1's data
  };
}
  
export function optimizeBoundingBoxes(boxes) {
  let optimized = false;
  const maxCount = 50000;
  let count = 0;
  do {
    optimized = false;
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
  
  return deduplicateBoxes(boxes);
}
  