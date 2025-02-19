const fs = require('fs').promises;
const path = require('path');

const fsInterface = {
  readFile: async (filePath) => (await fs.readFile(filePath)).buffer,
  readDir : async (filePath) => {
    const entries = await fs.readdir(filePath);
    const detailedEntries = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(filePath, entry);
        const stats = await fs.stat(fullPath);
        return {
          name       : entry,
          path       : fullPath,
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

module.exports = {
  fsInterface
};