import { createReducer, createAction } from '@reduxjs/toolkit';
import defaultState from '../defaultState';

export const actions = {
  addChatLine: createAction('ADD_CHAT_LINE', line => {
    return { payload: line };
  }),
  clearChat: createAction('CLEAR_CHAT', () => {
    return { };
  }),
};

export const reducer = createReducer(defaultState, builder => {
  builder.addCase(actions.addChatLine, (state, action) => {
    state.chat.chatLines.push(action.payload);
    return state;
  });
  builder.addCase(actions.clearChat, (state, _action) => {
    state.chat.chatLines = [];
    return state;
  });
});
