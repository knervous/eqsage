import { EQFileHandle } from '../../lib/model/file-handle';
import { GlobalStore } from '../../state';
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
        if (fileHandle.name.includes('global_chr')) {
          handles.push(await fileHandle.getFile()); 
        }
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }

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
  GlobalStore.actions.setLoading(true);
  GlobalStore.actions.setLoadingTitle('Processing Zone');
  GlobalStore.actions.setLoadingText('Loading Zone', zoneName);
  await new Promise(async (res, rej) => {
    const handles = [];
    try {
      for await (const fileHandle of getFilesRecursively(gameController.rootFileSystemHandle, '', new RegExp(`^${zoneName}[_\\.].*`))) {
        handles.push(await fileHandle.getFile()); 
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }

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
  GlobalStore.actions.setLoading(false);

}
