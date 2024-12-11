/* eslint-disable */

import { imageProcessor } from "../util/image/image-processor";
import { Zone } from "./zone/zone";
import { ZoneData } from "./zone/v4-zone";
import { Model, Animation, Lit } from "./model/model";
import { Eco } from "./eco/eco";
import { exportv4 } from "./gltf-export/v4";
import { exportv3 } from "./gltf-export/v3";
import { writeModels } from "./gltf-export/common";
import { PFSArchive } from "../pfs/pfs";
import {  getEQRootDir, writeEQFile } from "../util/fileHandler";
import { S3DDecoder } from "../s3d/s3d-decoder";

export class EQGDecoder {
  /** @type {import('../model/file-handle').EQFileHandle} */
  #fileHandle = null;

  /**
   * @type {Zone}
   */
  zone = null;

  /**
   * @type {Object.<string, import('./model/model').Model>}
   */
  models = {};

  /**
   * @type {Object.<string, import('./model/model').Animation>}
   */
  animations = {};

   /**
   * @type {Object.<string, import('./model/model').Lit>}
   */
  lits = {};

  /**
   * @type {Object.<string, import('./eco/eco').Eco>}
   */
  eco = {};

  /**
   * @type {ZoneData}
   */
  zoneData = null;

  /**
   *
   * @type {PFSArchive}
   */
  pfsArchive;

  constructor(fileHandle) {
    this.#fileHandle = fileHandle;
  }

  get name() {
    return this.#fileHandle.name;
  }

  async processBuffer(name, arrayBuffer) {
    this.pfsArchive = new PFSArchive();
    this.pfsArchive.openFromFile(arrayBuffer);
    const images = [];
    this.files = {};
    console.log("l dev", import.meta.env.VITE_LOCAL_DEV);
    for (const [fileName, data] of this.pfsArchive.files.entries()) {
      this.files[fileName] = this.pfsArchive.getFile(fileName);
      if (fileName.includes('broodlands')) {
        console.log('File', fileName)

      }
      if (fileName.endsWith(".lit")) {
      //  console.log('Filename', fileName, 'data', this.files[fileName])
        const lit = new Lit(
          this.files[fileName],
          this.#fileHandle,
          fileName
        );
        this.lits[lit.name] = lit;

      }
      if (import.meta.env.VITE_LOCAL_DEV === "true") {
        //await writeEQFile(name, fileName, this.files[fileName]);
      }
      if (fileName.endsWith(".zon")) {
        this.zone = Zone.Factory(
          this.files[fileName],
          this.#fileHandle,
          fileName,
          this.files
        );
      }

      if (fileName.endsWith(".ani")) {
        const ani = new Animation(
          this.files[fileName],
          this.#fileHandle,
          fileName
        );
        this.animations[ani.name] = ani;
      }

      if (fileName.endsWith(".mod") || fileName.endsWith(".ter")) {
        const model = new Model(
          this.files[fileName],
          this.#fileHandle,
          fileName
        );
        this.models[model.name] = model;
      }

      if (fileName.endsWith(".bmp") || fileName.endsWith(".dds")) {
        images.push({ name: fileName, data: this.files[fileName].buffer });
        continue;
      }
      if (fileName.endsWith('.png')) {
        await writeEQFile('textures', fileName, this.files[fileName]);
      }
      if (fileName.endsWith(".eco")) {
        this.eco[fileName.replace(".eco", "")] = new Eco(this.files[fileName]);
      }
      if (fileName.endsWith(".mds")) {
        //console.log("Had MDS! ", fileName);
      }
    }

    // Post process
    for (const [key, data] of Object.entries(this.files)) {
      if (key.endsWith(".dat")) {
        switch (key) {
          case "water.dat":
            break;
          case "floraexclusion.dat":
            break;
          case "invw.dat":
            break;
          default:
            this.zoneData = new ZoneData(
              data,
              this.#fileHandle,
              key,
              this.zone,
              this.models
            );
            break;
        }
      }
    }
    console.log(`Processed - ${name}`);
    await imageProcessor.parseImages(images, this.#fileHandle.rootFileHandle);
    console.log("Done processing images");
  }

  /**
   *
   * @param {FileSystemHandle} file
   */
  async processEQG(file) {
    console.log("handle eqg", file.name);

    const arrayBuffer = await file.arrayBuffer();
    await this.processBuffer(file.name, arrayBuffer);
  //  console.log('pfs', this.pfsArchive)
    // Entrypoint for testing
    if (import.meta.env.VITE_LOCAL_DEV === "true") {
      // const serZone = Zone.write(this.zone.terrain);
      // this.pfsArchive.setFile('broodlands.zon', serZone)
      // const eqgFile = await this.pfsArchive.saveToFile()
      // this.pfsArchive.deleteFile('ter_broodlands.lit');
      // await this.processBuffer(file.name, eqgFile);
      // await writeEQFile('zones_out', file.name, eqgFile);
      // console.log('Test wld in eqg');
      // const dir = getEQRootDir();
      // const fh = await dir.getFileHandle('qeynos2_obj.s3d').then(f => f.getFile());
      // const decoder = new S3DDecoder(fh);
      // await decoder.processS3D(fh);
      // const newOne = new PFSArchive();
      // console.log('dec', decoder)
      // for (const [fileName, _data] of decoder.pfsArchive.files.entries()) {
      //   if (!['.bmp', '.dds', '.wld'].some(ext => fileName.endsWith(ext))) {
      //     continue;
      //   }
      //   newOne.setFile(fileName.endsWith('wld') ? 'stillmoon_eqs1.wld' : fileName, decoder.pfsArchive.getFile(fileName));
      // }
      // const newEqg = await newOne.saveToFile();
      // await writeEQFile('zones_out', 'stillmoon_eqs1.s3d', newEqg);
      //this.pfsArchive.setFile('qeynos2_obj.wld', decoder.files)

    }
  }

  /**
   *
   * @param {import('./common/models').PlaceableGroup} p
   */
  async writeModels(p, zoneMetadata, modelFile, writtenModels, mod, v3) {
    return writeModels.apply(this, [
      p,
      zoneMetadata,
      modelFile,
      writtenModels,
      mod,
      v3,
    ]);
  }

  async export() {
    console.log("EQG Zone", this.zone);
    if (!this.zone) {
      for (const [name, mod] of Object.entries(this.models)) {
        if (!name.includes('ter_')) {
          await this.writeModels(name, mod);
        }
      }
    }
    if (this.zone?.header?.version === 4) {
      return exportv4.apply(this, [`${this.#fileHandle.name}`]);
    }
    return exportv3.apply(this, [`${this.#fileHandle.name}`]);
  }

  async process() {
    console.log("process", this.#fileHandle.name);
    const micro = performance.now();

    for (const file of this.#fileHandle.fileHandles) {
      const extension = file.name.split(".").pop();
      switch (extension) {
        case "eqg":
          await this.processEQG(file);
          break;
        case "txt":
          if (file.name.endsWith('_assets.txt')) {
            // const contents = (await file.text()).split('\r\n');
            // for (const line of contents) {
            //   if (line.endsWith('.eqg')) {
            //     console.log(`Loading dependent asset ${line}`);
            //     try {
            //       const dir = getEQRootDir();
            //       const fh = await dir.getFileHandle(line).then(f => f.getFile());
            //       await this.processEQG(fh);
            //     } catch(e) {
            //       console.log(`Error loading dependent asset`, e);
            //     }
              
            //   }
            // }
          }
          break;
        case "eff":
          break;
        case "xmi":
          break;
        case "emt":
          break;
        case "zon":
          this.zone = Zone.Factory(
            new Uint8Array(await file.arrayBuffer()),
            this.#fileHandle,
            file.name,
            []
          );
          break;
        default:
          console.warn(
            `Unhandled extension for ${this.#fileHandle.name} - ${extension}`
          );
      }
    }
    console.log(
      `Took ${((performance.now() - micro) / 1000).toFixed(4)} seconds.`
    );
  }
}
