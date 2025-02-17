import { TypedArrayReader } from '../../util/typed-array-reader';
import { decodeString } from '../../util/util';
import { ActorInstance, ActorDef } from '../animation/actor';
import { SkeletonHierarchy, SkeletonHierarchyReference } from '../animation/skeleton';
import { TrackDefFragment, TrackFragment } from '../animation/track';
import { BspTree } from '../bsp/bsp-tree';
import {
  AmbientLight,
  GlobalAmbientLight,
  LightInstance,
  LightSource,
  LightSourceReference,
} from '../lights/light';
import { BitmapInfo } from '../materials/bitmap-info';
import { BitmapName } from '../materials/bitmap-name';
import { Material } from '../materials/material';
import { MaterialList } from '../materials/material-list';
import { Sprite2D } from '../materials/sprite2d';
import { Mesh, MeshReference } from '../mesh/mesh';
import { MeshAnimatedVertices } from '../mesh/mesh-animated-vertices';
import {
  ParticleCloud,
  ParticleSprite,
  ParticleSpriteReference,
} from '../sprite/particle-sprite';
import {
  VertexColor,
  VertexColorReference,
} from '../vertex-color/vertex-color';
import { WldFragmentReference } from './wld-fragment';

/* eslint-disable */

export const WldType = {
  Zone: 0,
  ZoneObjects: 1,
  Lights: 2,
  Objects: 3,
  Sky: 4,
  Characters: 5,
  Equipment: 6,
};

export class Wld {
  /**
   * @type {TypedArrayReader}
   */
  reader = null;

  identifier = 0;
  version = 0;
  fragmentCount = 0;
  bspRegionCount = 0;
  stringTable = "";

  /**
   * @type {import('../bsp/bsp-tree').BspTree}
   */
  bspTree = null;

  /**
   * @type {Array<import('./wld-fragment').WldFragment>}
   */
  fragments = [];

  /**
   * @type {[SkeletonHierarchy]}
   */
  skeletons = [];

  /**
   * @type {[TrackDefFragment]}
   */
  trackDefs = [];

  /**
   * @type {[TrackFragment]}
   */
  tracks = [];

  /**
   * @type {[Mesh]}
   */
  meshes = [];
  /**
   * @type {[MaterialList]}
   */
  materialList = [];
  /**
   * @type {[ActorInstance]}
   */
  actors = [];

  /**
   * @type {[ActorDef]}
   */
  objects = [];

  /**
   * @type {[LightInstance]}
   */
  lights = [];

  /**
   *
   * @param {Uint8Array} data
   * @param {string} name
   */
  constructor(data, name) {
    this.reader = new TypedArrayReader(data.buffer);
    this.name = name;
    this.load();
  }

  get isNewWldFormat() {
    return this.version === 0x1000c800;
  }

  get type() {
    const typeMap = {
      "lights.wld": WldType.Lights,
      "objects.wld": WldType.ZoneObjects,
      "sky.wld": WldType.Sky,
    };
    if (typeMap[this.name]) {
      return typeMap[this.name];
    }
    if (this.name.endsWith("_obj.wld")) {
      return WldType.Objects;
    }
    if (this.name.endsWith("_chr.wld")) {
      return WldType.Characters;
    }
    if (this.name.startsWith("gequip")) {
      return WldType.Equipment;
    }
    if (this.name.endsWith('_amr.s3d')) {
      return WldType.Equipment;
    }

    // Default return zone
    return WldType.Zone;
  }

  load() {
    this.identifier = this.reader.readUint32();
    this.version = this.reader.readUint32();
    this.oldS3d = this.version === 0x00015500;
    this.fragmentCount = this.reader.readUint32();
    this.bspRegionCount = this.reader.readUint32();
    this.reader.addCursor(4);
    const stringHashSize = this.reader.readUint32();
    this.reader.addCursor(4);
    this.stringTable = decodeString(this.reader, stringHashSize);
    this.processFragments();
  }

  getString(idx) {
    if (idx >= 0) {
      return "";
    }
    return this.stringTable.substr(
      -idx,
      this.stringTable.indexOf("\0", -idx) + idx
    );
  }

  processFragments() {
    for (let i = 0; i < this.fragmentCount; i++) {
      const fragSize = this.reader.readUint32();
      const fragType = this.reader.readUint32();
      this.processFragment(fragSize, fragType, i);
    }
    // console.log('Frags', fragment);
  }

  processFragment(fragSize, fragType, fragIndex) {
    const originalCursor = this.reader.getCursor();
    const nameRef = this.reader.readInt32();
    const fragName = this.getString(nameRef);
    const addFragment = (Type) => {
      this.fragments[fragIndex] = new Type(this, fragName);
      return this.fragments[fragIndex];
    };
    switch (fragType) {
      // Materials
      case 0x03: // Texture Path
        addFragment(BitmapName);
        break;
      case 0x04: // Texture Info
        addFragment(BitmapInfo);
        break;
      case 0x05: // Texture Info Reference
        addFragment(WldFragmentReference);
        break;
      case 0x30: // Texture
        addFragment(Material);
        break;
      case 0x31: // TextureList
        this.materialList.push(addFragment(MaterialList));
        break;

      // BSP Tree
      case 0x21: // BSP Tree
        this.bspTree = new BspTree(this, fragName);
        break;
      case 0x22: // BSP Region
        this.bspTree.addRegion(fragName);
        break;
      case 0x29: // Region Type
        this.bspTree.addRegionType(fragName);
        break;

      // Meshes
      case 0x36: // Mesh
        this.meshes.push(addFragment(Mesh));
        break;
      case 0x37: // Mesh Animated Vertices
        addFragment(MeshAnimatedVertices);
        break;
      case 0x2f: // Mesh Animated Vertices reference
        addFragment(WldFragmentReference);
        break;
      case 0x2d: // Mesh reference
        addFragment(MeshReference);
        break;
      case 0x2c: // legacy mesh
        // don't map this for now
        break;

      // Objects /  Animation
      case 0x10: // Skeleton Track
        this.skeletons.push(addFragment(SkeletonHierarchy));
        break;
      case 0x11: // Skeleton Track Set Reference
        addFragment(SkeletonHierarchyReference);
        break;
      case 0x12: // Skeleton Piece Track
        this.trackDefs.push(addFragment(TrackDefFragment));
        break;
      case 0x13: // Skeleton Piece Track Ref
        this.tracks.push(addFragment(TrackFragment));
        break;
      case 0x14: // Static or Animated Model Ref/Player Info
        this.objects.push(addFragment(ActorDef));
        break;
      case 0x15: // Actor instance
        this.actors.push(addFragment(ActorInstance));
        break;

      // Lights
      case 0x1b:
        addFragment(LightSource);
        break;
      case 0x1c:
        addFragment(LightSourceReference);
        break;
      case 0x28:
        this.lights.push(addFragment(LightInstance));
        break;
      case 0x2a:
        addFragment(AmbientLight);
        break;
      case 0x35:
        addFragment(GlobalAmbientLight);
        break;

      case 0x32: // Vertex Color
        addFragment(VertexColor);
        break;
      case 0x33: // Vertex Color Ref
        addFragment(VertexColorReference);
        break;

      // Particle Cloud
      case 0x26:
        addFragment(ParticleSprite);
        break;
      case 0x27:
        addFragment(ParticleSpriteReference);
        break;
      case 0x34:
        addFragment(ParticleCloud);
        break;

      // Other
      case 0x06: // 2D object
        addFragment(Sprite2D);
        break;
      case 0x07: // 2D object Ref
        addFragment(WldFragmentReference);
        break;
      case 0x09: // Camera Ref
        addFragment(WldFragmentReference);
        break;

      case 0x08: // Camera
      case 0x16: // Zone Unknown

      default: {
        console.warn(`Unknown frag type - 0x${fragType.toString(16)}`);
      }
    }
    this.reader.setCursor(originalCursor + fragSize);
  }
}
