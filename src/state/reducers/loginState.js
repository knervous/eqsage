import { createReducer, createAction } from '@reduxjs/toolkit';
import defaultState from '../defaultState';

export const actions = {
  setLoginState: createAction('SET_LOGIN_STATE', loginState => {
    return { payload: loginState };
  }),
  resetLoginState: createAction('RESET_LOGIN_STATE', () => {
    return { };
  }),
  setSelectedServer: createAction('SET_SERVER', serverId => {
    return { payload: serverId };
  }),
};

export const reducer = createReducer(defaultState, builder => {
  builder.addCase(actions.setLoginState, (state, action) => {
    state.loginState = { ...state.loginState, ...action.payload };
    return state;
  });

  builder.addCase(actions.resetLoginState, (state) => {
    state.loginState = defaultState.loginState;
    return state;
  });

  builder.addCase(actions.setSelectedServer, (state, action) => {
    state.worldState.server = action.payload;
    return state;
  });
});
