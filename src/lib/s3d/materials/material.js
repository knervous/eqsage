import { Color } from '../common/color';
import { WldFragment } from '../wld/wld-fragment';

export const MaterialType = {
  // Used for boundaries that are not rendered. TextInfoReference can be null or have reference.
  Boundary                       : 0x0,
  // Standard diffuse shader
  Diffuse                        : 0x01,
  // Diffuse variant
  Diffuse2                       : 0x02,
  // Transparent with 0.5 blend strength
  Transparent50                  : 0x05,
  // Transparent with 0.25 blend strength
  Transparent25                  : 0x09,
  // Transparent with 0.75 blend strength
  Transparent75                  : 0x0A,
  // Non solid surfaces that shouldn't really be masked
  TransparentMaskedPassable      : 0x07,
  TransparentAdditiveUnlit       : 0x0B,
  TransparentMasked              : 0x13,
  Diffuse3                       : 0x14,
  Diffuse4                       : 0x15,
  TransparentAdditive            : 0x17,
  Diffuse5                       : 0x19,
  InvisibleUnknown               : 0x53,
  Diffuse6                       : 0x553,
  CompleteUnknown                : 0x1A, // TODO: Analyze this
  Diffuse7                       : 0x12,
  Diffuse8                       : 0x31,
  InvisibleUnknown2              : 0x4B,
  DiffuseSkydome                 : 0x0D, // Need to confirm
  TransparentSkydome             : 0x0F, // Need to confirm
  TransparentAdditiveUnlitSkydome: 0x10,
  InvisibleUnknown3              : 0x03,
};

export const ShaderType = {
  Diffuse                        : 0,
  Transparent25                  : 1,
  Transparent50                  : 2,
  Transparent75                  : 3,       
  TransparentAdditive            : 4,
  TransparentAdditiveUnlit       : 5,
  TransparentMasked              : 6,
  DiffuseSkydome                 : 7,
  TransparentSkydome             : 8, 
  TransparentAdditiveUnlitSkydome: 9,
  Invisible                      : 10,
  Boundary                       : 11,
};

export class Material extends WldFragment {
  brightness = 0;
  scaledAmbient = 0;
  bitmapInfoReferenceIdx = -1;
  shaderType = -1;
  isHandled = false;
  get bitmapInfo() {
    return this.wld.fragments[this.bitmapInfoReferenceIdx];
  }
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const flags = reader.readUint32();
    const parameters = reader.readUint32();

    this.color = new Color(reader.readUint8(), reader.readUint8(), reader.readUint8(), reader.readUint8());

    this.brightness = reader.readFloat32();
    this.scaledAmbient = reader.readFloat32();

    this.bitmapInfoReferenceIdx = reader.readUint32() - 1;

    const materialType = (parameters & ~0x80000000);
    switch (materialType) {
      case MaterialType.Boundary:
        this.shaderType = ShaderType.Boundary;
        break;
      case MaterialType.InvisibleUnknown:
      case MaterialType.InvisibleUnknown2:
      case MaterialType.InvisibleUnknown3:
        this.shaderType = ShaderType.Invisible;
        break;
      case MaterialType.Diffuse:
      case MaterialType.Diffuse3:
      case MaterialType.Diffuse4:
      case MaterialType.Diffuse6:
      case MaterialType.Diffuse7:
      case MaterialType.Diffuse8:
      case MaterialType.Diffuse2:
      case MaterialType.CompleteUnknown:
      case MaterialType.TransparentMaskedPassable:
        this.shaderType = ShaderType.Diffuse;
        break;
      case MaterialType.Transparent25:
        this.shaderType = ShaderType.Transparent25;
        break;
      case MaterialType.Transparent50:
        this.shaderType = ShaderType.Transparent50;
        break;
      case MaterialType.Transparent75:
        this.shaderType = ShaderType.Transparent75;
        break;
      case MaterialType.TransparentAdditive:
        this.shaderType = ShaderType.TransparentAdditive;
        break;
      case MaterialType.TransparentAdditiveUnlit:
        this.shaderType = ShaderType.TransparentAdditiveUnlit;
        break;
      case MaterialType.TransparentMasked:
      case MaterialType.Diffuse5:
        this.shaderType = ShaderType.TransparentMasked;
        break;
      case MaterialType.DiffuseSkydome:
        this.shaderType = ShaderType.DiffuseSkydome;
        break;
      case MaterialType.TransparentSkydome:
        this.shaderType = ShaderType.TransparentSkydome;
        break;
      case MaterialType.TransparentAdditiveUnlitSkydome:
        this.shaderType = ShaderType.TransparentAdditiveUnlitSkydome;
        break;
      default:
        this.shaderType = this.bitmapInfoReferenceIdx === 0 ? ShaderType.Invisible : ShaderType.Diffuse;
        break;
    }
  }
}