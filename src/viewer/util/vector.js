import BABYLON from '@bjs';

export const eqtoBabylonVector = (x, y, z) => {
  return new BABYLON.Vector3(y, z, x);
};

export const babylonToEqVector = (x, y, z) => {
  return new BABYLON.Vector3(z, x, y);
};

// x -> y       -  
// y -> z       -  
// z -> x       -  


