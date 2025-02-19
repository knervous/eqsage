import { EQFileHandle } from '../../lib/model/file-handle';
import { getEQFile, getFilesRecursively, writeEQFile } from '../../lib/util/fileHandler';
import { GlobalStore } from '../../state';
import { gameController } from '../../viewer/controllers/GameController';

export const GLOBAL_VERSION = 1.8;

export async function processGlobal(settings, rootFileSystemHandle, standalone = false) {
  gameController.rootFileSystemHandle = rootFileSystemHandle;
  if (standalone) {
    GlobalStore.actions.setLoading(true);

    // Preprocess globalload
    GlobalStore.actions.setLoadingTitle('Loading Global Dependencies');
  }
  return new Promise(async (res) => {
    const handles = [];
    try {
      for await (const fileHandle of getFilesRecursively(rootFileSystemHandle, '', new RegExp('^global.*\\.s3d'))) {
        if (/global(?:\d+)?_chr/.test(fileHandle.name) || fileHandle.name.includes('global_obj')) {
          handles.push(await fileHandle.getFile()); 
        }
      
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }
    console.log(`Loading handles: ${handles.map(h => h.name)}`);

    const obj = new EQFileHandle(
      'global_chr',
      handles,
      rootFileSystemHandle,
      settings
    );
    await obj.initialize();
    await obj.process();
    await writeEQFile('data', 'global.json', JSON.stringify({ version: GLOBAL_VERSION }));
    if (standalone) {
      gameController.openAlert('Done processing global');

      GlobalStore.actions.setLoading(false);
    }
    res();
  });
}

export async function processEquip(settings, rootFileSystemHandle, standalone = false) {
  gameController.rootFileSystemHandle = rootFileSystemHandle;
  if (standalone) {
    GlobalStore.actions.setLoading(true);

    // Preprocess globalload
    GlobalStore.actions.setLoadingTitle('Loading Global Equipment');
  }
  return new Promise(async (res) => {
    const handles = [];
    try {
      for await (const fileHandle of getFilesRecursively(rootFileSystemHandle, '', new RegExp('^gequip.*\\.s3d'))) {
        if (fileHandle.name.includes('gequip')) {
          handles.push(await fileHandle.getFile()); 
        }
      }

      for await (const fileHandle of getFilesRecursively(rootFileSystemHandle, '', new RegExp('^global.*_amr\\.s3d'))) {
        if (fileHandle.name.includes('_amr.s3d')) {
          handles.push(await fileHandle.getFile());
        }
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }

    const obj = new EQFileHandle(
      'gequip',
      handles, // handles.filter(h => h.name.endsWith('gequip.s3d')),
      rootFileSystemHandle,
      settings
    );
    await obj.initialize();
    await obj.process();
    await writeEQFile('data', 'gequip.json', JSON.stringify({ version: GLOBAL_VERSION }));
    if (standalone) {
      gameController.openAlert('Done processing gequip');

      GlobalStore.actions.setLoading(false);
    }
    res();
  });
}

export async function processZone(zoneName, settings, rootFileSystemHandle, _onlyChr = false) {
  gameController.rootFileSystemHandle = rootFileSystemHandle;
  GlobalStore.actions.setLoading(true);
  const v = await getEQFile('data', 'global.json', 'json');
  if (v?.version !== GLOBAL_VERSION) {
    await processGlobal(gameController.settings, gameController.rootFileSystemHandle, true);
  }
  console.log('Zone name', zoneName);
  GlobalStore.actions.setLoadingTitle(`Processing Zone ${zoneName}`);
  GlobalStore.actions.setLoadingText('Loading Zone', zoneName);
  let match = false;
  await new Promise(async (res) => {
    const handles = [];
    try {
      for await (const fileHandle of getFilesRecursively(rootFileSystemHandle, '', new RegExp(`^${zoneName}[_\\.].*`))) {
        // if (onlyChr && !(fileHandle.name.includes('_chr') || fileHandle.name.includes('_obj'))) {
        //   continue;
        // }
        handles.push(await fileHandle.getFile()); 
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }

    const obj = new EQFileHandle(
      zoneName,
      handles,
      rootFileSystemHandle,
      settings
    );
    await obj.initialize();
    match = await obj.process();
    res();
  });
  GlobalStore.actions.setLoading(false);
  return match;
}
