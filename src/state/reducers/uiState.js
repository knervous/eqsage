import { createReducer, createAction } from '@reduxjs/toolkit';
import defaultState from '../defaultState';

export const actions = {
  setSpawnOnScreen: createAction('SET_SPAWN_ON_SCREEN', spawn => {
    return { payload: spawn };
  }),
  setSpawnOffScreen: createAction('SET_SPAWN_OFF_SCREEN', spawn_id => {
    return { payload: spawn_id };
  }),
  setLoading: createAction('SET_LOADING', loading => {
    return { payload: loading };
  }),
  setLoadingText: createAction('SET_LOADING_TEXT', loading => {
    return { payload: loading };
  }),
};

export const reducer = createReducer(defaultState, builder => {
  builder.addCase(actions.setSpawnOnScreen, (state, action) => {
    state.ui.visibleSpawns[action.payload.id] = action.payload;
    return state;
  });

  builder.addCase(actions.setSpawnOffScreen, (state, action) => {
    delete state.ui.visibleSpawns[action.payload];
    return state;
  });

  builder.addCase(actions.setLoading, (state, action) => {
    state.ui.loading = action.payload;
    if (state.ui.loading === false) {
      state.ui.loadingText = '';
    }
    return state;
  });

  builder.addCase(actions.setLoadingText, (state, action) => {
    state.ui.loadingText = action.payload;
    return state;
  });
});
