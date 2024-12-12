import { deflate, inflate } from 'pako';
import { Buffer } from 'buffer';

const polynomial = 0x04C11DB7;
const MAX_BLOCK_SIZE = 8192; // the client will crash if you make this bigger, so don't.

function readUInt32LE(buffer, offset) {
  return (buffer[offset]) |
         (buffer[offset + 1] << 8) |
         (buffer[offset + 2] << 16) |
         (buffer[offset + 3] << 24);
}

function readInt32LE(buffer, offset) {
  const val = readUInt32LE(buffer, offset);
  return val > 0x7FFFFFFF ? val - 0x100000000 : val;
}

function writeUInt32LE(buffer, value, offset) {
  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = (value >> 8) & 0xFF;
  buffer[offset + 2] = (value >> 16) & 0xFF;
  buffer[offset + 3] = (value >> 24) & 0xFF;
}

function writeInt32LE(buffer, value, offset) {
  writeUInt32LE(buffer, value < 0 ? value + 0x100000000 : value, offset);
}

function concatTypedArrays(a, b) {
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

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
    const buffer = new Uint8Array(arrayBuffer);

    if (buffer.length < 12) {
      console.error('File too small to be a valid PFS archive');
      return false;
    }

    const dirOffset = readUInt32LE(buffer, 0);
    const magic = String.fromCharCode(buffer[4], buffer[5], buffer[6], buffer[7]);
    
    if (magic !== 'PFS ') {
      console.error('Magic word header mismatch');
      return false;
    }

    const dirCount = readUInt32LE(buffer, dirOffset);
    const directoryEntries = [];
    const filenameEntries = [];

    for (let i = 0; i < dirCount; ++i) {
      const entryOffset = dirOffset + 4 + i * 12;
      const crc = readInt32LE(buffer, entryOffset);
      const offset = readUInt32LE(buffer, entryOffset + 4);
      const size = readUInt32LE(buffer, entryOffset + 8);

      if (crc !== 0x61580ac9) {
        directoryEntries.push({ crc, offset, size });
        continue;
      }

      const filenameBuffer = new Uint8Array(buffer.slice(offset, offset + size));
      let filenameInflated;
      try {
        filenameInflated = this.inflateByFileOffset(filenameBuffer, 0, size);
      } catch (e) {
      }

      if (!filenameInflated) {
        console.error('Inflate directory failed');
        return false;
      }

      let filenamePos = 0;
      const filenameCount = readUInt32LE(filenameInflated, 0);
      filenamePos += 4;

      for (let j = 0; j < filenameCount; ++j) {
        const filenameLength = readUInt32LE(filenameInflated, filenamePos);
        filenamePos += 4;

        const filename = String.fromCharCode.apply(null, filenameInflated.slice(filenamePos, filenamePos + filenameLength - 1));
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

    try {
      this.footerDate = readUInt32LE(buffer, footerOffset + 5);
      this.footer = true;
    } catch (e) {
      this.footer = false;
    }

    return true;
  }

  saveToFile() {
    // We'll store all parts of the final file in this array.
    const parts = [];
    let currentLength = 0;
  
    // 1. Write header placeholder (12 bytes: 4 bytes for dirOffset placeholder, then 'PFS ', and some data)
    const header = new Uint8Array(12);
    parts.push(header);
    currentLength += 12;
  
    const preamble = new Uint8Array([0x50, 0x46, 0x53, 0x20, 0, 0, 2, 0]); // 'PFS ' and additional data
    header.set(preamble, 4);
  
    // 2. Prepare filesList. Instead of multiple concat calls, we will do it in one shot.
    let fileCount = 0;
    for (const [_fileName] of this.files) {
      fileCount++;
    }
  
    // Calculate total size needed for filesList
    // filesList structure:
    // [fileCount:4 bytes] [for each file: filenameLen(4 bytes) + filename(ASCII including NULL)]
    let filesListSize = 4; // for fileCount
    for (const [filename] of this.files) {
      const filenameLen = filename.length + 1; // +1 for null terminator
      filesListSize += 4 + filenameLen;
    }
  
    const filesList = new Uint8Array(filesListSize);
    let filePos = 0;
    writeUInt32LE(filesList, fileCount, filePos);
    filePos += 4;
  
    const dirEntries = [];
  
    // 3. Append each file's compressed data, track directory entries, and build filesList in one go
    for (const [filename, data] of this.files) {
      const crc = crcInstance.get(filename);
      const offset = currentLength;
      const sz = this.filesUncompressedSize.get(filename);
  
      // Append file data
      parts.push(data);
      currentLength += data.length;
  
      dirEntries.push({ crc, offset, sz });
  
      // Add filename to filesList
      const filenameLen = filename.length + 1;
      writeUInt32LE(filesList, filenameLen, filePos);
      filePos += 4;
      for (let i = 0; i < filename.length; ++i) {
        filesList[filePos++] = filename.charCodeAt(i);
      }
      filesList[filePos++] = 0; // Null terminator
    }
  
    // 4. Deflate the filesList and append
    const deflatedFileList = this.writeDeflatedFileBlock(filesList);
    if (!deflatedFileList) {
      return false;
    }
  
    const fileOffset = currentLength; // Where the filesList block is stored
    parts.push(deflatedFileList);
    currentLength += deflatedFileList.length;
  
    const fileSize = filesList.length;
  
    // 5. Write directory offset at the start
    const dirOffset = currentLength;
    writeUInt32LE(parts[0], dirOffset, 0); // parts[0] = header
  
    // 6. Directory count
    const dirCount = dirEntries.length + 1; // +1 for the filenames entry
    const dirCountBuffer = new Uint8Array(4);
    writeUInt32LE(dirCountBuffer, dirCount, 0);
    parts.push(dirCountBuffer);
    currentLength += 4;
  
    // 7. Append directory entries
    for (const { crc, offset, sz } of dirEntries) {
      const entryBuffer = new Uint8Array(12);
      writeInt32LE(entryBuffer, crc, 0);
      writeUInt32LE(entryBuffer, offset, 4);
      writeUInt32LE(entryBuffer, sz, 8);
      parts.push(entryBuffer);
      currentLength += 12;
    }
  
    // 8. Append the special directory entry for the filenames block
    const dirEntryBuffer = new Uint8Array(12);
    writeInt32LE(dirEntryBuffer, 0x61580AC9, 0);
    writeUInt32LE(dirEntryBuffer, fileOffset, 4);
    writeUInt32LE(dirEntryBuffer, fileSize, 8);
    parts.push(dirEntryBuffer);
    currentLength += 12;
  
    // 9. Append footer if any
    if (this.footer) {
      const footerBuffer = new Uint8Array(9);
      footerBuffer.set(new TextEncoder().encode('STEVE'), 0);
      writeUInt32LE(footerBuffer, this.footerDate, 5);
      parts.push(footerBuffer);
      currentLength += 9;
    }
  
    // 10. Concatenate everything into a single Uint8Array
    const finalBuffer = new Uint8Array(currentLength);
    {
      let offset = 0;
      for (const part of parts) {
        finalBuffer.set(part, offset);
        offset += part.length;
      }
    }
  
    return finalBuffer;
  }
  
  concatTypedArrays(a, b) {
    const c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
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
      const deflateLength = readUInt32LE(buffer, position);
      const inflateLength = readUInt32LE(buffer, position + 4);
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
      const deflateLength = readUInt32LE(buffer, position);
      const inflateLength = readUInt32LE(buffer, position + 4);
      const tempBuffer = buffer.slice(position + 8, position + 8 + deflateLength);

      const inflatedData = inflate(tempBuffer);
      if (inflatedData.length !== inflateLength) {
        throw new Error('ZLib Decompression failed');
      }

      outBuffer.set(inflatedData, inflateSize);
      inflateSize += inflateLength;
      position += deflateLength + 8;
    }

    return outBuffer;
  }

  writeDeflatedFileBlock(fileBuffer) {
    let outBuffer = new Uint8Array(0);
    let pos = 0;
    let remain = fileBuffer.length;

    while (remain > 0) {
      const sz = remain >= MAX_BLOCK_SIZE ? MAX_BLOCK_SIZE : remain;
      remain -= sz;

      const block = deflate(fileBuffer.slice(pos, pos + sz));
      pos += sz;

      const entryBuffer = new Uint8Array(8 + block.length);
      writeUInt32LE(entryBuffer, block.length, 0);
      writeUInt32LE(entryBuffer, sz, 4);
      entryBuffer.set(block, 8);
      outBuffer = concatTypedArrays(outBuffer, entryBuffer);
    }

    return outBuffer;
  }
}
