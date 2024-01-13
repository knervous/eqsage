import { GlobalStore } from '../store';
import { getThunkActions } from '../thunkActions';
import * as gameState from './gameState';
import * as loginState from './loginState';
import * as zoneState from './zoneState';
import * as uiState from './uiState';
import * as chatState from './chatState';

export const actions = {
  ...gameState.actions,
  ...loginState.actions,
  ...zoneState.actions,
  ...uiState.actions,
  ...chatState.actions,
};

/** @typedef {{ [T in keyof actions]: function(Parameters<actions[T]>): void }} BoundActions */

/**
 * @returns {BoundActions & import('../thunkActions').ThunkActionsType}
 */
export const getActions = () => {
  const { context, thunkActions } = getThunkActions();
  return Object.assign(
    thunkActions,
    ...Object.entries(actions).map(([name, func]) => ({
      [name] () {
        GlobalStore.dispatch(func.call(context, ...arguments));
      }
    }))
  );
};

export const reducer = (state, action) =>
  [
    uiState.reducer,
    zoneState.reducer,
    gameState.reducer,
    loginState.reducer,
    chatState.reducer,
  ].reduce((state, reducer) => window.rStore = reducer(state, action), state);
