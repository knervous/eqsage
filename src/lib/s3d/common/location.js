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
    this.rotateX = rotateX;
    this.rotateY = rotateY;
    this.rotateZ = rotateZ;
  }
}