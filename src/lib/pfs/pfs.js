import { deflate, inflate } from 'pako';
import { Buffer } from 'buffer';

const polynomial = 0x04C11DB7;

export class PFSCRC {
  constructor() {
    this.crcTable = new Int32Array(256);
    this.generateCRCTable();
  }

  generateCRCTable() {
    for (let i = 0; i < 256; ++i) {
      let crcAccum = i << 24;
      for (let j = 0; j < 8; ++j) {
        if ((crcAccum & 0x80000000) !== 0) {
          crcAccum = (crcAccum << 1) ^ polynomial;
        } else {
          crcAccum = crcAccum << 1;
        }
      }
      this.crcTable[i] = crcAccum;
    }
  }

  update(crc, data) {
    for (let i = 0; i < data.length; ++i) {
      const index = ((crc >> 24) ^ data[i]) & 0xFF;
      crc = (crc << 8) ^ this.crcTable[index];
    }
    return crc;
  }

  get(s) {
    if (s.length === 0) {
      return 0;
    }

    const buf = Buffer.alloc(s.length + 1);
    buf.write(s, 0, s.length, 'ascii');
    
    return this.update(0, buf);
  }
}

const crcInstance = new PFSCRC();

export class PFSArchive {
  constructor() {
    this.files = new Map();
    this.filesUncompressedSize = new Map();
    this.footer = false;
    this.footerDate = 0;
  }

  open() {
    this.close();
    return true;
  }

  openWithDate(date) {
    this.close();
    this.footer = true;
    this.footerDate = date;
    return true;
  }

  openFromFile(arrayBuffer) {
    this.close();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 12) {
      console.error('File too small to be a valid PFS archive');
      return false;
    }

    const dirOffset = buffer.readUInt32LE(0);
    const magic = buffer.slice(4, 8).toString('ascii');
    
    if (magic !== 'PFS ') {
      console.error('Magic word header mismatch');
      return false;
    }

    const dirCount = buffer.readUInt32LE(dirOffset);
    const directoryEntries = [];
    const filenameEntries = [];

    for (let i = 0; i < dirCount; ++i) {
      const entryOffset = dirOffset + 4 + i * 12;
      const crc = buffer.readInt32LE(entryOffset);
      const offset = buffer.readUInt32LE(entryOffset + 4);
      const size = buffer.readUInt32LE(entryOffset + 8);

      if (crc !== 0x61580ac9) {
        directoryEntries.push({ crc, offset, size });
        continue;
      }

      const filenameBuffer = this.inflateByFileOffset(buffer, offset, size);
      if (!filenameBuffer) {
        console.error('Inflate directory failed');
        return false;
      }

      let filenamePos = 0;
      const filenameCount = filenameBuffer.readUInt32LE(0);
      filenamePos += 4;

      for (let j = 0; j < filenameCount; ++j) {
        const filenameLength = filenameBuffer.readUInt32LE(filenamePos);
        filenamePos += 4;

        const filename = filenameBuffer.toString('ascii', filenamePos, filenamePos + filenameLength - 1);
        filenamePos += filenameLength;

        const filenameLower = filename.toLowerCase();
        const crc = crcInstance.get(filenameLower);
        filenameEntries.push({ crc, filename: filenameLower });
      }
    }

    for (const entry of directoryEntries) {
      const { crc, offset, size } = entry;

      for (const { crc: f_crc, filename } of filenameEntries) {
        if (crc === f_crc) {
          if (!this.storeBlocksByFileOffset(buffer, offset, size, filename)) {
            console.error('Store blocks by file offset failed');
            return false;
          }
          break;
        }
      }
    }

    const footerOffset = dirOffset + 4 + dirCount * 12;
    if (footerOffset >= buffer.length) {
      this.footer = false;
      return true;
    }

    this.footer = true;
    this.footerDate = buffer.readUInt32LE(footerOffset + 5);

    return true;
  }

  saveToFile() {
    let buffer = Buffer.alloc(0);

    let filesList = Buffer.alloc(0);
    let filePos = 0;

    const fileCount = this.files.size;
    filesList = Buffer.concat([filesList, Buffer.alloc(4)]);
    filesList.writeUInt32LE(fileCount, filePos);
    filePos += 4;

    const dirEntries = [];
    let fileOffset = 0;

    for (const [filename, data] of this.files) {
      const crc = crcInstance.get(filename);
      const offset = buffer.length;
      const size = this.filesUncompressedSize.get(filename);

      buffer = Buffer.concat([buffer, data]);

      dirEntries.push({ crc, offset, size });

      const filenameLen = filename.length + 1;
      const filenameBuffer = Buffer.alloc(filenameLen);
      filenameBuffer.write(filename, 0, filenameLen - 1, 'ascii');
      filesList = Buffer.concat([filesList, Buffer.alloc(4 + filenameLen)]);
      filesList.writeUInt32LE(filenameLen, filePos);
      filePos += 4;
      filenameBuffer.copy(filesList, filePos);
      filePos += filenameLen;
    }

    fileOffset = buffer.length;
    const deflatedFileList = this.writeDeflatedFileBlock(filesList);
    buffer = Buffer.concat([buffer, deflatedFileList]);

    const dirOffset = buffer.length;
    buffer = Buffer.concat([buffer, Buffer.alloc(4)]);
    buffer.writeUInt32LE(dirOffset, 0);

    const dirCount = dirEntries.length + 1;
    buffer = Buffer.concat([buffer, Buffer.alloc(4)]);
    buffer.writeUInt32LE(dirCount, dirOffset);

    // let curDirEntryOffset = dirOffset + 4;
    for (const { crc, offset, size } of dirEntries) {
      const entryBuffer = Buffer.alloc(12);
      entryBuffer.writeInt32LE(crc, 0);
      entryBuffer.writeUInt32LE(offset, 4);
      entryBuffer.writeUInt32LE(size, 8);
      buffer = Buffer.concat([buffer, entryBuffer]);
      // curDirEntryOffset += 12;
    }

    const dirEntryBuffer = Buffer.alloc(12);
    dirEntryBuffer.writeInt32LE(0x61580ac9, 0);
    dirEntryBuffer.writeUInt32LE(fileOffset, 4);
    dirEntryBuffer.writeUInt32LE(deflatedFileList.length, 8);
    buffer = Buffer.concat([buffer, dirEntryBuffer]);
    // curDirEntryOffset += 12;

    if (this.footer) {
      const footerBuffer = Buffer.alloc(5 + 4);
      footerBuffer.write('STEVE', 0, 5, 'ascii');
      footerBuffer.writeUInt32LE(this.footerDate, 5);
      buffer = Buffer.concat([buffer, footerBuffer]);
    }

    return buffer;
  }

  close() {
    this.footer = false;
    this.footerDate = 0;
    this.files.clear();
    this.filesUncompressedSize.clear();
  }

  getFile(filename) {
    const filenameLower = filename.toLowerCase();
    const data = this.files.get(filenameLower);

    if (data) {
      const uncompressedSize = this.filesUncompressedSize.get(filenameLower);
      return this.inflateByFileOffset(data, 0, uncompressedSize);
    }

    return null;
  }

  setFile(filename, data) {
    const filenameLower = filename.toLowerCase();

    const deflatedData = this.writeDeflatedFileBlock(data);
    this.files.set(filenameLower, deflatedData);
    this.filesUncompressedSize.set(filenameLower, data.length);

    return true;
  }

  deleteFile(filename) {
    const filenameLower = filename.toLowerCase();
    this.files.delete(filenameLower);
    this.filesUncompressedSize.delete(filenameLower);
    return true;
  }

  renameFile(filename, newFilename) {
    const filenameLower = filename.toLowerCase();
    const newFilenameLower = newFilename.toLowerCase();

    if (this.files.has(newFilenameLower)) {
      return false;
    }

    const data = this.files.get(filenameLower);
    if (data) {
      this.files.set(newFilenameLower, data);
      this.files.delete(filenameLower);

      const uncompressedSize = this.filesUncompressedSize.get(filenameLower);
      this.filesUncompressedSize.set(newFilenameLower, uncompressedSize);
      this.filesUncompressedSize.delete(filenameLower);
      return true;
    }

    return false;
  }

  fileExists(filename) {
    const filenameLower = filename.toLowerCase();
    return this.files.has(filenameLower);
  }

  getFilenames(ext) {
    const extLower = ext.toLowerCase();
    const outFiles = [];

    for (const filename of this.files.keys()) {
      if (extLower === '*' || filename.endsWith(extLower)) {
        outFiles.push(filename);
      }
    }

    return outFiles;
  }

  storeBlocksByFileOffset(buffer, offset, size, filename) {
    let position = offset;
    let inflateSize = 0;

    while (inflateSize < size) {
      const deflateLength = buffer.readUInt32LE(position);
      const inflateLength = buffer.readUInt32LE(position + 4);
      inflateSize += inflateLength;
      position += deflateLength + 8;
    }

    const blockSize = position - offset;
    const tbuffer = buffer.slice(offset, offset + blockSize);

    this.files.set(filename, tbuffer);
    this.filesUncompressedSize.set(filename, size);
    return true;
  }

  inflateByFileOffset(buffer, offset, size) {
    const outBuffer = new Uint8Array(size);
    let position = offset;
    let inflateSize = 0;
  
    while (inflateSize < size) {
      const deflateLength = buffer.readUInt32LE(position);
      const inflateLength = buffer.readUInt32LE(position + 4);
      const tempBuffer = buffer.slice(position + 8, position + 8 + deflateLength);
  
      const inflatedData = inflate(tempBuffer);
      if (inflatedData.length !== inflateLength) {
        throw new Error('ZLib Decompression failed');
      }
  
      outBuffer.set(inflatedData, inflateSize);
      inflateSize += inflateLength;
      position += deflateLength + 8;
    }
  
    return Buffer.from(outBuffer);
  }
  

  writeDeflatedFileBlock(fileBuffer) {
    let outBuffer = Buffer.alloc(0);
    let pos = 0;
    let remain = fileBuffer.length;

    while (remain > 0) {
      const sz = remain >= 8192 ? 8192 : remain;
      remain -= sz;

      const block = deflate(fileBuffer.slice(pos, pos + sz));
      pos += sz;

      const _idx = outBuffer.length;
      const entryBuffer = Buffer.alloc(8 + block.length);
      entryBuffer.writeUInt32LE(block.length, 0);
      entryBuffer.writeUInt32LE(sz, 4);
      block.copy(entryBuffer, 8);
      outBuffer = Buffer.concat([outBuffer, entryBuffer]);
    }

    return outBuffer;
  }
}