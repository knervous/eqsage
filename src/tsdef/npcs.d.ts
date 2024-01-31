type NpcByZoneQueryRequest = {
  relations?: string[];
  uniqueEntries?: Boolean;
};

export interface Npcs {
  getCleanName(name: String);
  getRaceImage(npc: any);
  isPlayableRace(raceId: any);

  specialAbilitiesToHuman(abilities);

  updateNpc(id: number, npcType: any);
  listNpcsByName(name: string, relations: any[]);

  getBaseNpcRelationships();

  listNpcsByEmoteId(emoteId: number, relations: any[]);

  listNpcsByNpcSpellsId(npcSpellsId: number, relations: any[]);

  getNpc(id: number, relations: any[]);

  getNpcsBulk(ids: number[], relations: any[]);

  getNpcsByZone(
    zoneShortName: string,
    version: number,
    request: NpcByZoneQueryRequest
  );

  // these were pulled from EOC and should be refined
  getFieldDescriptions();
  getFieldDescription(field: string);
  cacheExists(npc_id: any);
}
