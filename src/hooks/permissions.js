import { useCallback, useEffect, useState } from 'react';
import { get, set, del } from 'idb-keyval';
import { createDirectoryHandle } from '@/lib/util/fileSystem';

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

  useEffect(() => {
    if (
      permissionStatus === PermissionStatusTypes.NeedRefresh &&
      window.electronFS
    ) {
      setPermissionStatus(PermissionStatusTypes.Ready);
    }
  }, [permissionStatus]);

  const checkHandlePermissions = useCallback(
    async (h) => {
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
    },
    [fsHandle]
  );

  useEffect(() => {
    if (!apiSupported) {
      return;
    }
    (async () => {
      let persistedDir = await get(name);
      if (!persistedDir) {
        setPermissionStatus(PermissionStatusTypes.NeedEQDir);
        return;
      }
      if (window.electronAPI) {
        persistedDir = createDirectoryHandle(persistedDir);
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

  const onDrop = useCallback(
    async (e) => {
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
        if (window.electronAPI) {
          const path = window.electronAPI.getPath(e.dataTransfer.files[0]);
          setFsHandle(createDirectoryHandle(path));
          setPermissionStatus(PermissionStatusTypes.Ready);
          await set(name, path);
  
          return;
        }

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
    },
    [name]
  );

  const unlink = useCallback(async () => {
    await del(name);
    setFsHandle(null);
    setPermissionStatus(PermissionStatusTypes.NeedEQDir);
  }, [name]);

  const onFolderSelected = useCallback(async () => {
    if (window.electronAPI) {
      const selectedPath = await window.electronAPI.selectDirectory();
      set(name, selectedPath);
      const handle = createDirectoryHandle(selectedPath);
      setFsHandle(handle);
      setPermissionStatus(PermissionStatusTypes.Ready);
      return;
    }

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
      if (error.name !== 'AbortError') {
        // Ignore abort errors when user cancels the dialog
        console.error('Error selecting directory:', error);
      }
    }
  }, [name, checkHandlePermissions]);
  return [
    permissionStatus === PermissionStatusTypes.NeedRefresh && window.electronAPI
      ? PermissionStatusTypes.Ready
      : apiSupported
        ? permissionStatus
        : PermissionStatusTypes.ApiUnavailable,
    onDrop,
    checkHandlePermissions,
    fsHandle,
    onFolderSelected,
    unlink,
  ];
};
