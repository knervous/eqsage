export const EPSILON = 1e-5;

export function convertBabylonToEngineCoord(x, y, z) {
  return [-x, z, y];
}