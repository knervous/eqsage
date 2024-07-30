/* eslint-disable */
export class Location {
  x = 0;
  y = 0;
  z = 0;
  rotateZ = 0;
  rotateY = 0;
  rotateX = 0;

  constructor(x, y, z, rotateX, rotateY, rotateZ) {
    this.x = x;
    this.y = y;
    this.z = z;
    const modifier = 1.0 / 512.0 * 360.0;
    this.rotateX = 0;
    this.rotateZ = rotateY * modifier;
    this.rotateY = rotateX * modifier * -1;
  }
}