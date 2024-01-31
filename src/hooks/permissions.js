import { useCallback, useEffect, useState } from 'react';
import { clear, get, set } from 'idb-keyval';
import { gameController } from '../viewer/controllers/GameController';

export const PermissionStatusTypes = {
  ApiUnavailable: -1,
  Ready         : 0,
  NeedEQDir     : 1,
  NeedRefresh   : 2,
};

const apiSupported =
  typeof window.FileSystemHandle?.prototype?.queryPermission === 'function';

export const usePermissions = () => {
  const [permissionStatus, setPermissionStatus] = useState(
    PermissionStatusTypes.NeedEQDir
  );

  const checkHandlePermissions = useCallback(async () => {
    if (!gameController.rootFileSystemHandle) {
      return;
    }
    if (
      (await gameController.rootFileSystemHandle.requestPermission({
        mode: 'readwrite',
      })) === 'granted'
    ) {
      setPermissionStatus(PermissionStatusTypes.Ready);
    }
  }, []);

  useEffect(() => {
    if (!apiSupported) {
      return;
    }
    (async () => {
      const eqdir = await get('eqdir');
      if (!eqdir) {
        setPermissionStatus(PermissionStatusTypes.NeedEQDir);
        return;
      }
      gameController.rootFileSystemHandle = eqdir;

      setPermissionStatus(
        (await gameController.rootFileSystemHandle.queryPermission({
          mode: 'readwrite',
        })) === 'granted'
          ? PermissionStatusTypes.Ready
          : PermissionStatusTypes.NeedRefresh
      );
    })();
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!apiSupported) {
      return;
    }
    if (e.dataTransfer.items?.length) {
      const first = e.dataTransfer.items[0];
      if (first.getAsFileSystemHandle) {
        first
          .getAsFileSystemHandle()
          .then(async (handle) => {
            console.log('Handle', handle);
            if (handle.kind === 'file') {
            } else if (handle.kind === 'directory') {
              await clear();
              await set('eqdir', handle);
              gameController.rootFileSystemHandle = handle;
              setPermissionStatus(PermissionStatusTypes.NeedRefresh);
            }
          })
          .catch((e) => {
            console.warn('Could not get handle', e);
          });
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return [
    apiSupported ? permissionStatus : PermissionStatusTypes.ApiUnavailable,
    onDrop,
    checkHandlePermissions,
  ];
};
