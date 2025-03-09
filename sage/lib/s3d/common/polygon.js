export class Polygon {
  isSolid = true;
  v1 = 0;
  v2 = 0;
  v3 = 0;
  constructor(isSolid, v1, v2, v3) {
    this.isSolid = isSolid;
    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;
  }
}