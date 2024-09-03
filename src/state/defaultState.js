import { GAME_STATES } from './constants';


export const defaultState = {
  worldState: {
    server: -1
  },
  exploreMode: false,
  zoneInfo   : {
    zone     : 2,
    shortName: 'qeynos2',
    longName : 'North Qeynos',
  },
  zonePort: -1,
  zone    : {
    spawns: []
  },
  loginState: {
    success   : false,
    loggedIn  : false,
    loading   : false,
    triedLogin: false,
    lsid      : -1,
    key       : '',
    serverList: [],
    characters: [],
  },
  character: '',
  ip       : process.env.VITE_SAVE_IP === 'true' ?
    (localStorage.getItem('loginip') || process.env.VITE_EQ_SERVER) : process.env.VITE_EQ_SERVER,
  gameState: GAME_STATES.LOGIN,
  chat     : {
    chatLines: []
  },
  ui: {
    settingsOpen : false,
    visibleSpawns: {},
    loading      : false,
    loadingText  : '',
    loadingTitle : '',
  },
};

export default defaultState;