// These globals are interfaces we expect the consumer to be able to implement

export const globals = {
  gameController: {
    rootFileSystemHandle: null,
  },
  GlobalStore: {
    actions: {},
    getState() {},
  },
  BABYLON: {},
};

if (import.meta.env.DEV === true) {
  window.sageGlobals = globals;
}

export const setGlobals = (values = {}) => {
  for (const [key, value] of Object.entries(values)) {
    globals[key] = value;
  }
};