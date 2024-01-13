
import raceData from '../common/raceData.json';
import classData from '../common/classData.json';

export class Spawn {
  #data = {};
  constructor(data) {
    this.#data = data;
  }

  get anon() {
    return Boolean(this.#data.anon);
  }
  get face() {
    return this.#data.face ?? 0;
  }
  get name() {
    return this.#data.name ?? '';
  }
  get lastName() {
    return this.#data.last_name;
  }
  get displayedName() {
    const fullName = this.name.replace(/_/g, ' ').replace(/\d+$/, '');
    return this.currentHp <= 0 ? `${fullName}'s corpse` : 
      this.lastName?.length ? `${fullName} (${this.lastName})` : fullName;
  }
  get deity() {
    return this.#data.deity;
  }
  get size() {
    return this.#data.size;
  }
  get currentHp() {
    return this.#data.current_hp;
  }
  get maxHp() {
    return this.#data.max_hp;
  }
  get isNpc() {
    return this.#data.is_npc;
  }
  get level() {
    return this.#data.level;
  }
  get playerState() {
    return this.#data.player_state;
  }
  get petOwnerId() {
    return this.#data.pet_owner_id;
  }
  // Loc
  get x() {
    return this.#data.x;
  }
  get y() {
    return this.#data.y;
  }
  get z() {
    return this.#data.z;
  }
  get deltaX() {
    return this.#data.delta_x;
  }
  get deltaY() {
    return this.#data.delta_y;
  }
  get deltaZ() {
    return this.#data.delta_z;
  }
  get heading() {
    return this.#data.heading;
  }
  get runSpeed() {
    return this.#data.runspeed;
  }
  get afk() {
    return this.#data.afk;
  }
  get guildId() {
    return this.#data.guild_id;
  }
  get title() {
    return this.#data.title;
  }
  get helm() {
    return this.#data.helm;
  }
  get race() {
    return this.#data.race;
  }
  get id() {
    return this.#data.spawn_id;
  }
  get raceInfo() {
    return raceData.find(r => r.id === this.race);
  }
  get model() {
    return this.raceInfo?.[this.gender]?.toLowerCase() ?? '';
  }
  get class() {
    return this.#data.class;
  }
  get classInfo() {
    return classData[this.class];
  }
  get gender() {
    return this.#data.gender;
  }
  get boundingRadius() {
    return this.#data.bounding_radius;
  }
  get light() {
    return this.#data.light;
  }
  get equipChest() {
    return this.#data.equip_chest;
  }
  get bodyType() {
    return this.#data.bodytype;
  }
  get hasEquip() {
    return this.race >= 1 && this.race <= 13;
  }
  // Equipment
  get equipment() {
    return {
      head     : { id: this.#data.equip[0]?.material ?? 0, tint: this.#data.equip[0]?.color ?? { useTint: 0 } },
      chest    : { id: this.#data.equip[1]?.material ?? 0, tint: this.#data.equip[1]?.color ?? { useTint: 0 } },
      arms     : { id: this.#data.equip[2]?.material ?? 0, tint: this.#data.equip[2]?.color ?? { useTint: 0 } },
      wrist    : { id: this.#data.equip[3]?.material ?? 0, tint: this.#data.equip[3]?.color ?? { useTint: 0 } },
      hands    : { id: this.#data.equip[4]?.material ?? 0, tint: this.#data.equip[4]?.color ?? { useTint: 0 } },
      legs     : { id: this.#data.equip[5]?.material ?? 0, tint: this.#data.equip[5]?.color ?? { useTint: 0 } },
      feet     : { id: this.#data.equip[6]?.material ?? 0, tint: this.#data.equip[6]?.color ?? { useTint: 0 } },
      primary  : { id: this.#data.equip[7]?.material ?? 0, tint: this.#data.equip[7]?.color ?? { useTint: 0 } },
      secondary: { id: this.#data.equip[8]?.material ?? 0, tint: this.#data.equip[8]?.color ?? { useTint: 0 } },
    };
  }
}