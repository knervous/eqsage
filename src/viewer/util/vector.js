import { Vector3 } from '@babylonjs/core/Maths/math.vector';

export const eqtoBabylonVector = (x, y, z) => {
  return new Vector3(y, z, x);
};

export const babylonToEqVector = (x, y, z) => {
  return new Vector3(z, x, y);
};

// x -> y       -  
// y -> z       -  
// z -> x       -  


