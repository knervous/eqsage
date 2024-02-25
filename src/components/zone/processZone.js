import { EQFileHandle } from '../../lib/model/file-handle';
import { gameController } from '../../viewer/controllers/GameController';

async function* getFilesRecursively(entry, path = '', nameCheck = undefined) {
  if (entry.kind === 'file') {
    const file = await entry;
    if (file !== null) {
      if (nameCheck && nameCheck.test(file.name)) {
        file.relativePath = path;
        yield file;
      }
    }
  } else if (entry.kind === 'directory') {
    if (entry.name === 'eqsage') {
      return;
    }
    for await (const handle of entry.values()) {
      yield* getFilesRecursively(handle, `${path}/${handle.name}`, nameCheck);
    }
  }
}

export async function processGlobal(settings) {
  console.log('global');
  return new Promise(async (res, rej) => {
    const handles = [];
    try {
      for await (const fileHandle of getFilesRecursively(gameController.rootFileSystemHandle, '', new RegExp('^global(\\d+)?[_\\.].*'))) {
        handles.push(await fileHandle.getFile()); 
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }
    console.log('File handles', handles);

    const obj = new EQFileHandle(
      'global',
      handles,
      gameController.rootFileSystemHandle,
      settings
    );
    await obj.initialize();
    await obj.process();
    res();
  });
}

export async function processZone(zoneName, settings) {
  console.log('Zone name', zoneName);
  return new Promise(async (res, rej) => {
    const handles = [];
    try {
      for await (const fileHandle of getFilesRecursively(gameController.rootFileSystemHandle, '', new RegExp(`^${zoneName}[_\\.].*`))) {
        handles.push(await fileHandle.getFile()); 
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }
    console.log('File handles', handles);

    const obj = new EQFileHandle(
      zoneName,
      handles,
      gameController.rootFileSystemHandle,
      settings
    );
    await obj.initialize();
    await obj.process();
    res();
  });
}
