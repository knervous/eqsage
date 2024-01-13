import { createReducer, createAction } from '@reduxjs/toolkit';
import defaultState from '../defaultState';

export const actions = {
  setZoneInfo: createAction('SET_ZONE_INFO', zoneInfo => {
    return { payload: zoneInfo };
  }),
  setZonePort: createAction('SET_ZONE_PORT', zonePort => {
    return { payload: zonePort };
  }),
  addZoneSpawns: createAction('ADD_ZONE_SPAWNS', spawns => {
    return { payload: spawns };
  }),
  clearZoneSpawns: createAction('CLEAR_ZONE_SPAWNS', () => {
    return {};
  }),
  removeZoneSpawns: createAction('REMOVE_ZONE_SPAWNS', spawns => {
    return { payload: spawns };
  }),
  updateZoneSpawn: createAction('UPDATE_ZONE_SPAWN', spawn => {
    return { payload: spawn };
  }),
};

export const reducer = createReducer(defaultState, builder => {
  builder.addCase(actions.setZoneInfo, (state, action) => {
    state.zoneInfo = action.payload;
    return state;
  });

  builder.addCase(actions.setZonePort, (state, action) => {
    state.zonePort = action.payload;
    return state;
  });

  builder.addCase(actions.addZoneSpawns, (state, action) => {
    state.zone.spawns.push(...action.payload);
    return state;
  });

  builder.addCase(actions.clearZoneSpawns, (state) => {
    state.zone.spawns = [];
    return state;
  });

  builder.addCase(actions.removeZoneSpawns, (state, action) => {
    state.zone.spawns = state.zone.spawns.filter(s => !action.payload.some(si => si.spawn_id === s.spawn_id));
    return state;
  });

  builder.addCase(actions.updateZoneSpawn, (state, action) => {
    const idx = state.zone.spawns.findIndex(s => s.spawn_id === action.payload.spawn_id);
    if (idx !== -1) {
      state.zone.spawns[idx] = { ...state.zone.spawns[idx], ...action.payload };
    }
    return state;
  });

});
