
import { WeaponStats } from './types';

export const SCREEN_WIDTH = 1024;
export const SCREEN_HEIGHT = 768; 
export const VIEW_WIDTH = 512; // Higher internal resolution for "64-bit" crispness
export const VIEW_HEIGHT = 384;

export const MOVEMENT_SPEED = 5.0; // Units per second
export const ROTATION_SPEED = 3.0; // Radians per second

export const TILE_SIZE = 64; 

export const COLORS = {
  UI_BG: '#1a1a1a',
  UI_TEXT: '#00ff00',
  UI_DANGER: '#ff0000',
};

export const TEXTURES = {
  WALL_1: '#555555',
  WALL_2: '#554444',
  WALL_3: '#445544',
  ENEMY: '#ff0000',
  AMMO: '#ffff00',
  HEALTH: '#0000ff',
  ARMOR: '#00ffff',
  EXIT: '#ffffff',
};

export const WEAPONS: Record<string, WeaponStats> = {
  CROWBAR: {
    id: 'CROWBAR',
    name: 'CROWBAR',
    damage: 35,
    range: 1.5,
    cooldown: 0.4,
    ammoCost: 0,
    color: '#777777'
  },
  PISTOL: {
    id: 'PISTOL',
    name: 'PISTOL',
    damage: 15,
    range: 15.0,
    cooldown: 0.3,
    ammoCost: 1,
    color: '#333333'
  },
  SHOTGUN: {
    id: 'SHOTGUN',
    name: 'SHOTGUN',
    damage: 60, // Max damage
    range: 8.0,
    cooldown: 1.0,
    ammoCost: 3,
    color: '#3e2723'
  }
};
