/* eslint-disable */

import zlib from 'pako';
import { Buffer } from 'buffer';
import { TypedArrayReader } from '../util/typed-array-reader';
import { imageProcessor } from '../util/image/image-processor';
import { Zone, ZoneData } from './zone/zone';
import { Model } from './model/model';
import { Eco } from './eco/eco';
import { exportv4 } from './gltf-export/v4';
import { exportv3 } from './gltf-export/v3';
import { writeModels } from './gltf-export/common';
import { PFSArchive } from '../pfs/pfs';
import { writeEQFile } from '../util/fileHandler';

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
   * @type {Object.<string, import('./eco/eco').Eco>}
   */
  eco = {};

  /**
   * @type {ZoneData}
   */
  zoneData = null;

  constructor(fileHandle) {
    this.#fileHandle = fileHandle;
  }

  /**
   *
   * @param {FileSystemHandle} file
   */
  async processEQG(file) {
    console.log('handle eqg', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const pfsArchive = new PFSArchive();
    pfsArchive.openFromFile(arrayBuffer);
    const images = [];
    this.files = {};
    for (const [fileName, data] of pfsArchive.files.entries()) {
      this.files[fileName] = pfsArchive.getFile(fileName);
      if (fileName.endsWith('.lit')) {
        // console.log('Filename', fileName, 'data', this.files[fileName])
      }
      // await writeEQFile('files', fileName, f.data);
      if (fileName.endsWith('.zon')) {
        this.zone = new Zone(this.files[fileName], this.#fileHandle, fileName, this.files);
      }

      if (fileName.endsWith('.mod') || fileName.endsWith('.ter')) {
        const model = new Model(this.files[fileName], this.#fileHandle, fileName);
        this.models[model.name] = model;
      }

      if (fileName.endsWith('.bmp') || fileName.endsWith('.dds')) {
        images.push({ name: fileName, data: this.files[fileName].buffer });
        continue;
      }
      if (fileName.endsWith('.eco')) {
        this.eco[fileName.replace('.eco', '')] = new Eco(this.files[fileName]);
      }
    }

    // Post process
    for (const [key, data] of Object.entries(this.files)) {
      if (key.endsWith('.dat')) {
        switch (key) {
          case 'water.dat':
            break;
          case 'floraexclusion.dat':
            break;
          case 'invw.dat':
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
    console.log(`Processed - ${file.name}`);
    await imageProcessor.parseImages(images, this.#fileHandle.rootFileHandle);
    console.log('Done processing images');

    // Entrypoint for testing
    if (process.env.REACT_APP_LOCAL_DEV === 'true') {
      const eqgFile = await pfsArchive.saveToFile();
      await writeEQFile('zones_out', file.name, eqgFile);
    }
   
  }

  /**
   * 
   * @param {import('./common/models').PlaceableGroup} p 
   */
  async writeModels(p, zoneMetadata, modelFile, writtenModels, mod, v3) {
    return writeModels.apply(this, [p, zoneMetadata, modelFile, writtenModels, mod, v3]);
  }

  async export() {
    console.log('EQG Zone', this.zone);
    if (this.zone.header.version === 4) {
      return exportv4.apply(this, [`${this.#fileHandle.name}`]);
    }
    return exportv3.apply(this, [`${this.#fileHandle.name}`]);
  }

  async process() {
    console.log('process', this.#fileHandle.name);
    imageProcessor.initializeWorkers();
    const micro = performance.now();

    for (const file of this.#fileHandle.fileHandles) {
      const extension = file.name.split('.').pop();
      switch (extension) {
        case 'eqg':
          await this.processEQG(file);
          break;
        case 'txt':
          break;
        case 'eff':
          break;
        case 'xmi':
          break;
        case 'emt':
          break;
        case 'zon':
          this.zone = new Zone(
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
    imageProcessor.clearWorkers();
  }
}
