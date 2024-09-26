import React, { useCallback, useMemo, useState } from 'react';
import { useZoneBuilderContext } from './context';

/**
 * @typedef OverlayContext
 * @property {(name: string, value: boolean, clearAll: boolean) => void} toggleDrawer
 * @property {() => void} closeDrawers
 * @property {object} drawerState
 * @property {string?} openDrawer
 */

const OverlayContext = React.createContext({});

/**
 *
 * @returns {OverlayContext}
 */
export const useOverlayContext = () => React.useContext(OverlayContext);

export const OverlayProvider = ({ children }) => {
  const { zone } = useZoneBuilderContext();
  const [drawerState, setDrawerState] = useState({});
  const toggleDrawer = useCallback(
    (name, value, clearAll = true) =>
      setDrawerState((prevState) =>
        clearAll ? { [name]: value } : { ...prevState, [name]: value }
      ),
    []
  );
  const closeDrawers = useCallback(() => setDrawerState({}), []);
  const openDrawer = useMemo(() => Object.entries(drawerState).find(([key, val]) => key !== 'settings' && val)?.[0], [drawerState]);

  return (
    <OverlayContext.Provider
      value={{
        openDrawer,
        drawerState,
        toggleDrawer,
        closeDrawers,
        zone
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
};
