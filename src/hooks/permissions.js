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

/**
 * Custom React hook to manage file system permissions and handle directory selection.
 *
 * @param {string} [name='eqdir'] - The key name used for storing the directory handle in IndexedDB.
 * @returns {[number, Function, Function, Function, FileSystemDirectoryHandle|null]} An array containing:
 *   - `permissionStatus` (number): Current permission status.
 *   - `onDrop` (Function): Callback to handle drop events.
 *   - `onFolderSelected` (Function): Callback to open the directory picker.
 *   - `checkHandlePermissions` (Function): Function to check and update permissions.
 *   - `fsHandle` (FileSystemDirectoryHandle|null): The current file system handle.
 */
export const usePermissions = (name = 'eqdir') => {
  const [fsHandle, setFsHandle] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(
    PermissionStatusTypes.NeedEQDir
  );


  const checkHandlePermissions = useCallback(async (h) => {
    const handle = fsHandle || h;
    if (!handle) {
      return;
    }
    if (
      (await handle.requestPermission({
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

  const onFolderSelected = useCallback(
    async () => {
      if (!apiSupported) {
        console.warn('File System Access API is not supported in this browser.');
        return;
      }
      try {
        const handle = await window.showDirectoryPicker();
        if (handle.kind === 'directory') {
          await del(name);
          await set(name, handle);
          setFsHandle(handle);
          checkHandlePermissions(handle);
          setPermissionStatus(PermissionStatusTypes.NeedRefresh);
        } else {
          console.warn('Selected handle is not a directory.');
        }
      } catch (error) {
        if (error.name !== 'AbortError') { // Ignore abort errors when user cancels the dialog
          console.error('Error selecting directory:', error);
        }
      }
    },
    [name, checkHandlePermissions]
  );
  return [
    apiSupported ? permissionStatus : PermissionStatusTypes.ApiUnavailable,
    onDrop,
    checkHandlePermissions,
    fsHandle,
    onFolderSelected,
  ];
};
