import { createContext, useContext } from 'react';

export const ZoneBuilderContext = createContext({});

export const useZoneBuilderContext = () => useContext(ZoneBuilderContext);