import * as Comlink from 'comlink';
import { CreateQuail } from './wrapper';
import {
  createDirectoryHandle,
  createFileSystemHandle,
} from '@/lib/util/fileSystem';
/**
 * @typedef QueueItem
 * @property {string} name
 * @property {ArrayBuffer} data
 */

/**
 *
 * @param {[QueueItem]} entries
 * @param {FileSystemDirectoryHandle} eqFileHandle
 */
async function convertS3D(name, zone, textures, lights, objects) {
  console.log('Quail Worker convert');
  const { quail, fs } = await CreateQuail('/static/quail.wasm');

  // Write JSON
  const encoder = new TextEncoder();
  fs.setEntry(
    `/${name}.json`,
    fs.makeFileEntry(undefined, encoder.encode(JSON.stringify(zone)))
  );
  if (lights) {
    fs.setEntry(
      `/${name}_lights.json`,
      fs.makeFileEntry(undefined, encoder.encode(JSON.stringify(lights)))
    );
  }
  if (objects) {
    fs.setEntry(
      `/${name}_objects.json`,
      fs.makeFileEntry(undefined, encoder.encode(JSON.stringify(objects)))
    );
  }

  fs.setEntry(`/${name}`, fs.makeDirEntry());
  // Write textures
  for (const texture of textures) {
    fs.setEntry(
      `/${name}/${texture.name}`,
      fs.makeFileEntry(undefined, new Uint8Array(texture.buffer))
    );
  }

  quail.convert(`/${name}.json`, `/${name}.s3d`);
  const output = fs.files.get(`/${name}.s3d`);

  return output
    ? Comlink.transfer(output.data.buffer, [output.data.buffer])
    : null;
}

/**
 *
 * @param {FileSystemFileHandle} fileHandle
 */
const getFileText = async (fileHandle) => {
  const rootBuffer = await fileHandle
    .getFile()
    .then((f) => f.arrayBuffer())
    .catch(() => null);
  if (!rootBuffer) {
    console.log(`Root did not exist in fileHandle ${fileHandle.name}`);
    return null;
  }
  const rootText = new TextDecoder('utf8').decode(rootBuffer);

  return rootText;
};

/**
 *
 * @param {FileSystemDirectoryHandle} fileHandle
 */
async function parseWce(fileHandle) {
  if (typeof fileHandle === 'string') {
    fileHandle = createDirectoryHandle(fileHandle);
  }
  console.log('Quail Worker convert');
  const { quail, fs } = await CreateQuail('/static/quail.wasm');
  fs.reset();
  const prefix = `${fileHandle.name}`;
  fs.files.set(`/${prefix}`, {
    type    : 'dir',
    children: new Map(), // sub-paths
    mode    : 0o040000,
    ctime   : new Date(),
    mtime   : new Date(),
  });
  const rootFh = await fileHandle.getFileHandle('_root.wce');
  if (!rootFh) {
    console.log(`Root did not exist in fileHandle ${fileHandle.name}`);
    return null;
  }
  const rootText = await getFileText(rootFh);

  const lines = [];
  for (const line of rootText.split('\n')) {
    if (line.trim().startsWith('//')) {
      continue;
    }
    const rootRegex = /"(\w+)\/_ROOT\.WCE/gmi;
    let match;
    if ((match = rootRegex.exec(line)) !== null) {
      lines.push(match[1]);
    }
  }

  const textureFiles = new Set();
  for (const line of lines) {
    const dirHandle = await fileHandle
      .getDirectoryHandle(line.toLowerCase())
      .catch(() => null);
    if (dirHandle) {
      for await (const [_name, handle] of dirHandle.entries()) {
        const fileText = await getFileText(handle);
        const textureRegex = /"(\w+\.(?:DDS|BMP))"/gmi;
        let match;
        while ((match = textureRegex.exec(fileText)) !== null) {
          textureFiles.add(match[1]);
        }
      }
    }
  }
  const recurse = async (dirHandle, path = '') => {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'directory') {
        fs.files.set(`/${path}${name}`, {
          type    : 'dir',
          children: new Map(),
          mode    : 0o040000,
          ctime   : new Date(),
          mtime   : new Date(),
        });
        await recurse(handle, `${path}${name}/`);
      } else {
        if (name.includes('bmp') || name.includes('dds')) {
          if (!textureFiles.has(name.toUpperCase())) {
            continue;
          }
        }
        fs.setEntry(
          `${path}${name}`,
          fs.makeFileEntry(
            undefined,
            new Uint8Array(await handle.getFile().then((f) => f.arrayBuffer()))
          )
        );
      }
    }
  };

  await recurse(fileHandle, `${prefix}/`);
  quail.convert(prefix, `${fileHandle.name}.s3d`);
  const data = fs.files.get(`/${fileHandle.name}.s3d`).data;
  return data;
}

/**
 *
 * @param {FileSystemFileHandle} file
 * @param {FileSystemDirectoryHandle} folder
 * @param {string} name
 */
const createQuail = async (file, folder) => {
  if (typeof file === 'string') {
    file = createFileSystemHandle(file);
  }
  if (typeof folder === 'string') {
    folder = createDirectoryHandle(folder);
  }

  try {
    const { quail, fs } = await CreateQuail('/static/quail.wasm');
    fs.reset();

    // Read the file as an array buffer
    const arrayBuffer = await file.getFile().then((f) => f.arrayBuffer());
    const uint8Array = new Uint8Array(arrayBuffer);

    // Write the file to quail filesystem
    const baseName = file.name.replace(/\.[^/.]+$/, ''); // e.g., "qeynos2"
    const inputS3D = `/${file.name}`;
    fs.setEntry(inputS3D, fs.makeFileEntry(undefined, uint8Array));

    const baseQuailName = `${baseName}.quail`;
    quail.convert(inputS3D, `/${baseQuailName}`);
    const rootDirHandle = await folder.getDirectoryHandle(baseQuailName, {
      create: true,
    });
    await Promise.all(
      fs.files.entries().map(async ([key, value]) => {
        if (
          key === '/' ||
          key.slice(1) === baseQuailName ||
          key.endsWith('.s3d') ||
          key.endsWith('.eqg')
        ) {
          return;
        }
        const pathParts = key.split('/').filter(Boolean);

        if (value.type === 'dir') {
          const dirName = pathParts.at(-1);
          await rootDirHandle.getDirectoryHandle(dirName, { create: true });
        } else {
          const fName = pathParts.at(-1);
          let dirHandle = rootDirHandle;
          for (const [idx, part] of Object.entries(pathParts)) {
            if (part === dirHandle.name || +idx === pathParts.length - 1) {
              continue;
            }

            dirHandle = await dirHandle.getDirectoryHandle(part, {
              create: true,
            });
          }
          const writableHandle = await dirHandle.getFileHandle(fName, {
            create: true,
          });
          if (writableHandle) {
            const writable = await writableHandle.createWritable();
            await writable.write(value.data);
            await writable.getWriter().releaseLock();
            await writable.close();
          }
        }
      })
    );
    console.log('FS', fs);
  } catch (e) {
    console.log('Error parsing', e);
  }
};

const exports = { convertS3D, parseWce, createQuail };

/** @type {typeof exports} */
const exp = Object.fromEntries(
  Object.entries(exports).map(([key, fn]) => [
    key,
    async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        console.error('Worker error', error);
      }
    },
  ])
);

export default exp;

Comlink.expose(exp);
