import zlib from 'pako';
import { Buffer } from 'buffer';
import { Wld } from './wld/wld';
import { TypedArrayReader } from '../util/typed-array-reader';


export class S3DDecoder {
  /** @type {import('../model/file-handle').EQFileHandle} */
  #fileHandle = null;

  #wld = [];
  #gequip = false;

  constructor(fileHandle) {
    this.#fileHandle = fileHandle;
    this.#gequip = this.#fileHandle.name.startsWith('gequip');
  }

  /**
   * 
   * @param {FileSystemHandle} file 
   */
  async processS3D(file) {
    console.log('handle s3d', file);
    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.length === 0) {
      return;
    }
    const reader = new TypedArrayReader(arrayBuffer);
    const offset = reader.readUint32();
    reader.setCursor(offset);
    const fileList = [];
    const count = reader.readUint32();
    let directory = null;
    for (let i = 0; i < count; i++) {
      reader.setCursor(offset + 4 + i * 12);
      const crc = reader.readUint32();
      const fileOffset = reader.readUint32();
      const size = reader.readUint32();
      const data = Buffer.alloc(size);
      let writeCursor = 0;
      reader.setCursor(fileOffset);
      while (writeCursor < size) {
        const deflen = reader.readUint32();
        const inflen = reader.readUint32();
        const inflated = Buffer.from(
          zlib.inflate(buf.slice(reader.getCursor(), reader.getCursor() + deflen))
        );
        if (inflated.length !== inflen) {
          throw new Error('ZLib Decompression failed');
        }
        inflated.copy(data, writeCursor);
        reader.setCursor(reader.getCursor() + deflen);
        writeCursor += inflen;
      }
      if (crc === 0x61580ac9) {
        directory = data;
      } else {
        fileList.push({ foff: fileOffset, data });
      }
    }
    fileList.sort((a, b) => {
      return a.foff - b.foff;
    });

    const dirBufferReader = new TypedArrayReader(directory.buffer);
    const _dirlen = dirBufferReader.readUint32();

    const files = {};
    for (const f of fileList) {
      const fileName = dirBufferReader.readString(dirBufferReader.readUint32());
      files[fileName] = f.data;
    }
    console.log(`Processed :: ${file.name}`);
    const wld = files[`${this.#fileHandle.name}.wld`];
    const obj = files['objects.wld'];
    // console.log(Object.keys(files));

    for (const [name, wldFile] of Object.entries(files).filter(([key]) => key.endsWith('.wld'))) {
      console.log(`Processing WLD file :: ${ name}`);
      const zone = new Wld(wldFile, this.#fileHandle);
    }
    
  }

  async process() {
    console.log('process', this.#fileHandle.name);
    for (const file of this.#fileHandle.fileHandles) {
      const extension = file.name.split('.').pop();

      switch (extension) {
        case 's3d':
          await this.processS3D(file);
          break;
        case 'txt':

          break;
        case 'eff':

          break;
        case 'xmi':

          break;

        case 'emt':

          break;
        default:
          console.warn(`Unhandled extension for ${this.#fileHandle.name} :: ${extension}`);
      }
    }
  }
}