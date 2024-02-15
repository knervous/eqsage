import React, { useCallback, useState } from 'react';

/**
 * @typedef OverlayContext
 * @property {(name: string, value: boolean, clearAll: boolean) => void} toggleDialog
 * @property {() => void} closeDialogs
 * @property {object} dialogState
 */

const OverlayContext = React.createContext({});

/**
 *
 * @returns {OverlayContext}
 */
export const useOverlayContext = () => React.useContext(OverlayContext);

export const OverlayProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({});
  const toggleDialog = useCallback(
    (name, value, clearAll = true) =>
      setDialogState((prevState) =>
        clearAll ? { [name]: value } : { ...prevState, [name]: value }
      ),
    []
  );
  const closeDialogs = useCallback(() => setDialogState({}), []);
  return (
    <OverlayContext.Provider
      value={{
        dialogState,
        toggleDialog,
        closeDialogs,
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
};
