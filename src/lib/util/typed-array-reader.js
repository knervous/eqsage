export class TypedArrayReader {
  /**
   *
   * @param {ArrayBuffer} buffer
   */
  constructor(buffer, cursor = 0) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.cursor = cursor;
  }

  readInt8() {
    const value = this.view.getInt8(this.cursor);
    this.cursor += Int8Array.BYTES_PER_ELEMENT;
    return value;
  }

  readUint8() {
    const value = this.view.getUint8(this.cursor);
    this.cursor += Uint8Array.BYTES_PER_ELEMENT;
    return value;
  }

  readInt16() {
    const value = this.view.getInt16(this.cursor, true); // true for little-endian
    this.cursor += Int16Array.BYTES_PER_ELEMENT;
    return value;
  }

  readUint16() {
    const value = this.view.getUint16(this.cursor, true); // true for little-endian
    this.cursor += Uint16Array.BYTES_PER_ELEMENT;
    return value;
  }

  readInt32() {
    const value = this.view.getInt32(this.cursor, true); // true for little-endian
    this.cursor += Int32Array.BYTES_PER_ELEMENT;
    return value;
  }

  readUint32() {
    const value = this.view.getUint32(this.cursor, true); // true for little-endian
    this.cursor += Uint32Array.BYTES_PER_ELEMENT;
    return value;
  }

  readFloat32() {
    const value = this.view.getFloat32(this.cursor, true); // true for little-endian
    this.cursor += Float32Array.BYTES_PER_ELEMENT;
    return value;
  }

  readFloat64() {
    const value = this.view.getFloat64(this.cursor, true); // true for little-endian
    this.cursor += Float64Array.BYTES_PER_ELEMENT;
    return value;
  }

  readManyInt8(count) {
    return Array.from({ length: count }, this.readInt16.bind(this));
  }

  readManyUint8(count) {
    return Array.from({ length: count }, this.readUint8.bind(this));
  }

  readManyInt16(count) {
    return Array.from({ length: count }, this.readInt16.bind(this));
  }

  readManyUint16(count) {
    return Array.from({ length: count }, this.readUint16.bind(this));
  }

  readManyInt32(count) {
    return Array.from({ length: count }, this.readInt32.bind(this));
  }

  readManyUint32(count) {
    return Array.from({ length: count }, this.readUint32.bind(this));
  }

  readManyFloat32(count) {
    return Array.from({ length: count }, this.readFloat32.bind(this));
  }

  readManyFloat64(count) {
    return Array.from({ length: count }, this.readFloat64.bind(this));
  }

  previewString(length) {
    const charStr = [];
    for (let i = 0; i < length; i++) {
      const byte = this.readUint8();
      if (byte !== 0) {
        charStr.push(byte);
      }
    }
    this.setCursor(this.getCursor() - length);
    return new TextDecoder().decode(new Uint8Array(charStr).buffer);
  }

  readString(length) {
    const charStr = [];
    for (let i = 0; i < length; i++) {
      const byte = this.readUint8();
      if (byte !== 0) {
        charStr.push(byte);
      }
    }
    return new TextDecoder().decode(new Uint8Array(charStr).buffer);
  }

  readCString() {
    const charStr = [];
    let notTerminated = false;
    do {
      const byte = this.readUint8();
      if (byte !== 0) {
        charStr.push(byte);
      } else {
        notTerminated = true;
      }
    } while (notTerminated === false);
    return new TextDecoder().decode(new Uint8Array(charStr).buffer);
  }

  readCStringFromIdx(idx) {
    const currIdx = this.getCursor();
    this.setCursor(idx);
    const val = this.readCString();
    this.setCursor(currIdx);
    return val.trim();
  }

  readByteArray(length) {
    const charStr = [];
    for (let i = 0; i < length; i++) {
      const byte = this.readUint8();
      if (byte !== 0) {
        charStr.push(byte);
      }
    }
    return new Uint8Array(charStr);
  }

  // Method to get the current cursor position
  getCursor() {
    return this.cursor;
  }

  // Method to set the cursor position
  setCursor(position) {
    if (position >= 0 && position <= this.buffer.byteLength) {
      this.cursor = position;
      this.warned = false;
      return true;
    }
    if (!this.warned) {
      this.warned = true;
      console.warn(
        `Setting position beyond buffer bytelength ${position} > ${this.buffer.byteLength}`
      );
    }
    return false;
  }

  addCursor(amount) {
    this.setCursor(this.getCursor() + amount);
  }
}


export class TypedArrayWriter {
  /**
   *
   * @param {ArrayBuffer} buffer
   */
  constructor(buffer, cursor = 0) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.cursor = cursor;
  }

  writeInt8(value) {
    this.view.setInt8(this.cursor, value);
    this.cursor += Int8Array.BYTES_PER_ELEMENT;
  }

  writeUint8(value) {
    this.view.setUint8(this.cursor, value);
    this.cursor += Uint8Array.BYTES_PER_ELEMENT;
  }

  writeInt16(value) {
    this.view.setInt16(this.cursor, value, true); // true for little-endian
    this.cursor += Int16Array.BYTES_PER_ELEMENT;
  }

  writeUint16(value) {
    this.view.setUint16(this.cursor, value, true); // true for little-endian
    this.cursor += Uint16Array.BYTES_PER_ELEMENT;
  }

  writeInt32(value) {
    this.view.setInt32(this.cursor, value, true); // true for little-endian
    this.cursor += Int32Array.BYTES_PER_ELEMENT;
  }

  writeUint32(value) {
    this.view.setUint32(this.cursor, value, true); // true for little-endian
    this.cursor += Uint32Array.BYTES_PER_ELEMENT;
  }

  writeFloat32(value) {
    this.view.setFloat32(this.cursor, value, true); // true for little-endian
    this.cursor += Float32Array.BYTES_PER_ELEMENT;
  }

  writeFloat64(value) {
    this.view.setFloat64(this.cursor, value, true); // true for little-endian
    this.cursor += Float64Array.BYTES_PER_ELEMENT;
  }

  writeManyInt8(values) {
    values.forEach((value) => {
      this.writeInt8(value);
    });
  }

  writeManyUint8(values) {
    values.forEach((value) => {
      this.writeUint8(value);
    });
  }

  writeManyInt16(values) {
    values.forEach((value) => {
      this.writeInt16(value);
    });
  }

  writeManyUint16(values) {
    values.forEach((value) => {
      this.writeUint16(value);
    });
  }

  writeManyInt32(values) {
    values.forEach((value) => {
      this.writeInt32(value);
    });
  }

  writeManyUint32(values) {
    values.forEach((value) => {
      this.writeUint32(value);
    });
  }

  writeManyFloat32(values) {
    values.forEach((value) => {
      this.writeFloat32(value);
    });
  }

  writeManyFloat64(values) {
    values.forEach((value) => {
      this.writeFloat64(value);
    });
  }

  writeString(value) {
    const encoder = new TextEncoder();
    const encodedString = encoder.encode(value);
    for (const byte of encodedString) {
      this.writeUint8(byte);
    }
  }

  writeCString(value) {
    const encoder = new TextEncoder();
    const encodedString = encoder.encode(value);
    for (const byte of encodedString) {
      this.writeUint8(byte);
    }
    // Write null terminator
    this.writeUint8(0);
  }

  // Method to get the current cursor position
  getCursor() {
    return this.cursor;
  }

  // Method to set the cursor position
  setCursor(position) {
    if (position >= 0 && position <= this.buffer.byteLength) {
      this.cursor = position;
      this.warned = false;
      return true;
    }
    if (!this.warned) {
      this.warned = true;
      console.warn(
        `Setting position beyond buffer bytelength ${position} > ${this.buffer.byteLength}`
      );
    }
    return false;
  }

  addCursor(amount) {
    this.setCursor(this.getCursor() + amount);
  }
}