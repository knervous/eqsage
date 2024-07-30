/* eslint-disable */
import { vec3 } from 'gl-matrix';

export const heightWithinQuad = (p1, p2, p3, p4, x, y) => {
  let inTriangle = 0;

  const n = vec3.create();
  let a = vec3.create();
  let b = vec3.create();
  let c = vec3.create();

  let fAB = (y - p1[1]) * (p2[0] - p1[0]) - (x - p1[0]) * (p2[1] - p1[1]);
  let fBC = (y - p2[1]) * (p3[0] - p2[0]) - (x - p2[0]) * (p3[1] - p2[1]);
  let fCA = (y - p3[1]) * (p1[0] - p3[0]) - (x - p3[0]) * (p1[1] - p3[1]);

  if (fAB * fBC >= 0 && fBC * fCA >= 0) {
    inTriangle = 1;
    a = p1;
    b = p2;
    c = p3;
  }

  fAB = (y - p1[1]) * (p3[0] - p1[0]) - (x - p1[0]) * (p3[1] - p1[1]);
  fBC = (y - p3[1]) * (p4[0] - p3[0]) - (x - p3[0]) * (p4[1] - p3[1]);
  fCA = (y - p4[1]) * (p1[0] - p4[0]) - (x - p4[0]) * (p1[1] - p4[1]);

  if (fAB * fBC >= 0 && fBC * fCA >= 0) {
    inTriangle = 2;
    a = p1;
    b = p3;
    c = p4;
  }

  n[0] = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
  n[1] = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  n[2] = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

  const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);

  n[0] /= len;
  n[1] /= len;
  n[2] /= len;

  return (n[0] * (x - a[0]) + n[1] * (y - a[1])) / -n[2] + a[2];
};
