
const idbVersion = 4;
const dataTable = 'data';
const dataTableData = 'data';

export const getDataTable = () =>
  new Promise(res => {
    const dataTableRequest = indexedDB.open(dataTable, idbVersion);
    dataTableRequest.onsuccess = res;
    dataTableRequest.onupgradeneeded = event => {
      /** @type {IDBDatabase} */
      const db = event.target.result;
      try {
        db.deleteObjectStore(dataTableData);
      } catch { }
      const dataStore = db.createObjectStore(dataTableData, {
        keyPath: 'dataPath'
      });
      dataStore.createIndex('dataPath', 'dataPath', { unique: false });
      indexedDB.deleteDatabase('babylonjs');
      setTimeout(() => {
        window.location.reload();
      }, 500);
      res();
    };
  });

export const deleteDatabase = name =>
  new Promise(res => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess =
            request.onerror =
            request.onupgradeneeded =
            request.onblocked =
            res;
  });

export const getDataEntry = dataPath =>
  new Promise(res => {
    const request = indexedDB.open(dataTable, idbVersion);
    request.onsuccess = async event => {
      /** @type {IDBDatabase} */
      const db = event.target.result;
      try {
        const transaction = db.transaction([dataTableData]);
        const dataStore = transaction.objectStore(dataTableData);
        const dataRequest = dataStore.get(dataPath);
        dataRequest.onerror = () => res(null);
        dataRequest.onsuccess = () => {
          res(dataRequest.result);
        };
      } catch (e) {
        console.warn({ message: 'Error with data transaction', error: e });
        await deleteDatabase(dataTable);
        await getDataTable();
        res(await getDataEntry(dataPath));
      }
    };
    request.onerror = e => {
      console.warn('Error', e);
      res(undefined);
    };
  });

export const setDataEntry = (dataPath, data) =>
  new Promise(res => {
    const request = indexedDB.open(dataTable, idbVersion);
    request.onsuccess = event => {
      /** @type {IDBDatabase} */
      const db = event.target.result;
      const dataStore = db
        .transaction(dataTableData, 'readwrite')
        .objectStore(dataTableData);
      const dataRequest = dataStore.put({ data, dataPath });

      dataRequest.onerror = () => res(null);
      dataRequest.onsuccess = () => res(dataRequest.result);
    };
    request.onerror = () => res(undefined);
  });

getDataTable();