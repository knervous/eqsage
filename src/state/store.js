import { createContext, createElement } from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider, createStoreHook, createDispatchHook, createSelectorHook } from 'react-redux';

import defaultState from './defaultState';
import { reducer, getActions } from './reducers';

/**
 * @typedef AdditionalGlobalStoreProperties
 * @property {ReturnType<getActions>} actions
 */

/** @type {import('@reduxjs/toolkit').EnhancedStore<import('./defaultState.d.ts')> & AdditionalGlobalStoreProperties} */
export const GlobalStore = configureStore({
  devTools      : true,
  preloadedState: defaultState,
  reducer,
});


GlobalStore.actions = getActions();

/** Set up the react-redux context, and hooks */

const GlobalContext = createContext();

export const useStore = createStoreHook(GlobalContext);
export const useDispatch = createDispatchHook(GlobalContext);

/**
 * @template T
 * @param {(store: import('./defaultState')) => T} selector
 * @returns {T}
 */
export const useSelector = createSelectorHook(GlobalContext);

/** Wrap react-redux Provier with some initialization logic for overriding the default state */
export const GlobalStoreProvider = ({ children }) => {
  return createElement(Provider, {
    context: GlobalContext,
    store  : GlobalStore,
    children,
  });
};
