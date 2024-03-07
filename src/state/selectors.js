export const GameState = {
  /** @param {import('./defaultState')} store */
  state      : store => store.gameState,
  /** @param {import('./defaultState')} store */
  loginState : store => store.loginState,
  /** @param {import('./defaultState')} store */
  exploreMode: store => store.exploreMode,
  /** @param {import('./defaultState')} store */
  ip         : store => store.ip,
};

export const ZoneState = {
  /** @param {import('./defaultState')} store */
  zoneInfo : store => store.zoneInfo,
  /** @param {import('./defaultState')} store */
  character: store => store.character,
  /** @param {import('./defaultState')} store */
  zonePort : store => store.zonePort
};

export const Zone = {
  spawns: store => store.zone.spawns,
};

export const UiState = {
  visibleSpawns: store => store.ui.visibleSpawns,
  loading      : store => store.ui.loading,
  loadingText  : store => store.ui.loadingText,
  loadingTitle : store => store.ui.loadingTitle,
};

export const ChatState = {
  lines: store => store.chat.chatLines
};