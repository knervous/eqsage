
async function* getDirFiles(entry, fromRecurse = false) {
  if (entry.kind === 'file') {
    const file = await entry;
    if (file !== null) {
      yield file;
    }
  } else if (!fromRecurse && entry.kind === 'directory') {
    for await (const handle of entry.values()) {
      yield* getDirFiles(handle, true);
    }
  }
}
    
export async function getFiles(entry, path = '') {
  const files = [];
  try {
    const pathHandle = await entry.getDirectoryHandle(path, {
      create: true,
    });
      
    for await (const file of getDirFiles(pathHandle)) {
      files.push(file);
    }
  } catch (e) {
    console.warn(e);
  }
 
  return files;
}
  