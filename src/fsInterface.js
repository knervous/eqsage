
import { promises as fs } from 'fs';
import path from 'path';

export const fsInterface = {
  readFile    : async (filePath) => (await fs.readFile(filePath).catch(() => null))?.buffer,
  deleteFile  : async (filePath) => (await fs.unlink(filePath).catch(() => null)),
  deleteFolder: async (folderPath) => {
    await fs.rm(folderPath, { recursive: true, force: true }).catch(() => {});
  },
  readDir: async (filePath) => {
    const entries = await fs.readdir(filePath);
    const detailedEntries = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(filePath, entry);
        const stats = await fs.stat(fullPath);
        return {
          name       : entry,
          path       : fullPath.replaceAll('\\', '/'),
          isDirectory: stats.isDirectory(),
          isFile     : stats.isFile()
        };
      })
    );
    return detailedEntries;
  },
  createIfNotExist: async (path) => {
    try {
      await fs.access(path);
    } catch {
      await fs.mkdir(path);
    }
  },
  writeFile: async (filePath, data) => await fs.writeFile(filePath, data),
};