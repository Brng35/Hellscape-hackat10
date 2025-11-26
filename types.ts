
export interface Vector2 {
  x: number;
  y: number;
}

export type WeaponType = 'CROWBAR' | 'PISTOL' | 'SHOTGUN';

export interface WeaponStats {
  id: WeaponType;
  name: string;
  damage: number;
  range: number;
  cooldown: number;
  ammoCost: number;
  color: string;
}

export interface Player {
  id: 1 | 2;
  pos: Vector2;
  dir: Vector2; // Direction vector
  plane: Vector2; // Camera plane vector (determines FOV)
  health: number;
  shield: number; // New Shield Stat
  maxShield: number;
  isKnocked: boolean; // New Knocked State
  ammo: number;
  weaponTimer: number; // For cooldown
  score: number;
  currentWeaponIndex: number;
  weapons: WeaponType[];
  activePowerups: {
    QUAD_DAMAGE?: number; // Time remaining in ms
    INVULNERABILITY?: number;
  };
  visitedTiles: string[]; // Array of "x,y" strings for fog of war
}

export type EntityType = 'ENEMY' | 'AMMO' | 'HEALTH' | 'ARMOR' | 'EXIT' | 'PLAYER' | 'POWERUP_QUAD' | 'POWERUP_INVULNERABILITY';
export type EnemySubType = 'MELEE' | 'RANGED';
export type AIState = 'IDLE' | 'CHASE' | 'ATTACK' | 'RETREAT';

export interface Entity {
  id: string;
  type: EntityType;
  subType?: EnemySubType; // Only for enemies
  aiState?: AIState;      // Only for enemies
  pos: Vector2;
  active: boolean;
  textureId: number;
  health?: number;        // Only for enemies
  lastAttackTime?: number;// For AI cooldown
  path?: Vector2[];       // Pathfinding queue
  lastPathTime?: number;  // Throttle pathfinding recalculation
  deathAnimation?: {
    timer: number;
    duration: number;
  };
}

export interface Level {
  id: number;
  map: number[][]; // 0 = empty, >0 = wall texture ID
  startPosP1: Vector2;
  startPosP2: Vector2;
  entities: Entity[];
  ceilingColor: string;
  floorColor: string;
  wallColors: string[]; // Fallback solid colors or gradients
}

export interface GameState {
  isPlaying: boolean;
  levelIndex: number;
  players: {
    1: Player;
    2: Player;
  };
  entities: Entity[];
  lastTime: number;
  gameOver: boolean;
  winner: string | null;
}

export enum Keys {
  W = 'w',
  A = 'a',
  S = 's',
  D = 'd',
  SPACE = ' ',
  Z = 'z',
  V = 'v', // Revive Key
  UP = 'ArrowUp',
  DOWN = 'ArrowDown',
  LEFT = 'ArrowLeft',
  RIGHT = 'ArrowRight',
  MINUS = '-',
  PLUS = '=', // Usually + is Shift+=
  PLUS_NUMPAD = '+',
  ENTER = 'Enter',
  CTRL = 'Control',
  ALT = 'Alt', // Backdoor key
  N = 'n',     // Backdoor key
}
