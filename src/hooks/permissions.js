import { useCallback, useEffect, useState } from 'react';
import { get, set, del } from 'idb-keyval';

export const PermissionStatusTypes = {
  ApiUnavailable: -1,
  Ready         : 0,
  NeedEQDir     : 1,
  NeedRefresh   : 2,
};

const apiSupported =
  typeof window.FileSystemHandle?.prototype?.queryPermission === 'function';

export const usePermissions = (name = 'eqdir') => {
  const [fsHandle, setFsHandle] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(
    PermissionStatusTypes.NeedEQDir
  );


  const checkHandlePermissions = useCallback(async () => {
    if (!fsHandle) {
      return;
    }
    if (
      (await fsHandle.requestPermission({
        mode: 'readwrite',
      })) === 'granted'
    ) {
      setPermissionStatus(PermissionStatusTypes.Ready);
    }
  }, [fsHandle]);

  useEffect(() => {
    if (!apiSupported) {
      return;
    }
    (async () => {
      const persistedDir = await get(name);
      if (!persistedDir) {
        setPermissionStatus(PermissionStatusTypes.NeedEQDir);
        return;
      }
      setFsHandle(persistedDir);
      setPermissionStatus(
        (await persistedDir.queryPermission({
          mode: 'readwrite',
        })) === 'granted'
          ? PermissionStatusTypes.Ready
          : PermissionStatusTypes.NeedRefresh
      );
    })();
  }, [name]);

  const onDrop = useCallback(async (e) => {
    if (e?.kind === 'directory') {
      await del(name);
      await set(name, e);
      setFsHandle(e);
      setPermissionStatus(PermissionStatusTypes.NeedRefresh);
      return;
    }
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
              await del(name);
              await set(name, handle);
              setFsHandle(handle);
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
  }, [name]);

  return [
    apiSupported ? permissionStatus : PermissionStatusTypes.ApiUnavailable,
    onDrop,
    checkHandlePermissions,
    fsHandle
  ];
};
