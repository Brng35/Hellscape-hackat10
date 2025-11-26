
import { Level, Entity, Vector2 } from './types';

// Helper to ensure entities don't spawn in walls
const spawnEntities = (
  map: number[][], 
  count: number, 
  type: 'ENEMY' | 'AMMO' | 'HEALTH' | 'ARMOR', 
  p1Start: Vector2, 
  p2Start: Vector2
): Entity[] => {
  const entities: Entity[] = [];
  const height = map.length;
  const width = map[0].length;
  
  let attempts = 0;
  // SAFE ZONE RADIUS SQUARED (10 units = 100)
  const SAFE_ZONE_SQ = 100;

  while (entities.length < count && attempts < count * 20) {
    attempts++;
    const x = Math.floor(Math.random() * (width - 2)) + 1;
    const y = Math.floor(Math.random() * (height - 2)) + 1;
    
    // Check collision with walls
    if (map[y][x] > 0) continue;

    // Check distance from spawn (don't spawn on top of players)
    const d1 = (x - p1Start.x)**2 + (y - p1Start.y)**2;
    const d2 = (x - p2Start.x)**2 + (y - p2Start.y)**2;
    
    // Much larger safe zone to prevent immediate damage
    if (d1 < SAFE_ZONE_SQ || d2 < SAFE_ZONE_SQ) continue; 

    let subType: 'MELEE' | 'RANGED' | undefined;
    let health = 0;
    
    if (type === 'ENEMY') {
      // 40% chance of Ranged, 60% Melee
      subType = Math.random() > 0.6 ? 'RANGED' : 'MELEE';
      health = subType === 'MELEE' ? 50 : 40;
    }

    entities.push({
      id: `${type}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      subType,
      pos: { x: x + 0.5, y: y + 0.5 },
      active: true,
      textureId: 1, // Default, engine handles variety
      health,
      aiState: 'IDLE'
    });
  }
  return entities;
};

const createMap = (width: number, height: number, density: number = 0.2, safePoints: Vector2[] = []): number[][] => {
  const map: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push(1); // Border walls
      } else {
        // Force safe points to be empty
        const isSafe = safePoints.some(p => Math.floor(p.x) === x && Math.floor(p.y) === y);
        if (isSafe) {
            row.push(0);
            continue;
        }

        // Random walls, but keep center somewhat clear
        const isCenter = x > width/3 && x < (width/3)*2 && y > height/3 && y < (height/3)*2;
        const localDensity = isCenter ? density * 0.5 : density;
        
        // Random texture ID 1, 2, or 3
        const wallType = Math.floor(Math.random() * 3) + 1; 
        row.push(Math.random() < localDensity ? wallType : 0);
      }
    }
    map.push(row);
  }
  return map;
};

// --- LEVEL DEFINITIONS ---

// Level 1: The Outpost (20x20)
const P1_START_1 = { x: 2.5, y: 2.5 };
const P2_START_1 = { x: 17.5, y: 17.5 };
const MAP_1 = createMap(20, 20, 0.15, [P1_START_1, P2_START_1]);
const ENTITIES_1 = [
  ...spawnEntities(MAP_1, 15, 'ENEMY', P1_START_1, P2_START_1),
  ...spawnEntities(MAP_1, 8, 'AMMO', P1_START_1, P2_START_1),
  ...spawnEntities(MAP_1, 4, 'HEALTH', P1_START_1, P2_START_1),
  ...spawnEntities(MAP_1, 3, 'ARMOR', P1_START_1, P2_START_1),
  { id: 'p_quad', type: 'POWERUP_QUAD', pos: { x: 10.5, y: 10.5 }, active: true, textureId: 4 } as Entity,
  { id: 'exit', type: 'EXIT', pos: { x: 10.5, y: 10.5 }, active: true, textureId: 0 } as Entity
];

// Level 2: The Facility (30x30) - Denser
const P1_START_2 = { x: 2.5, y: 2.5 };
const P2_START_2 = { x: 27.5, y: 27.5 };
const MAP_2 = createMap(30, 30, 0.2, [P1_START_2, P2_START_2]);
const ENTITIES_2 = [
  ...spawnEntities(MAP_2, 35, 'ENEMY', P1_START_2, P2_START_2),
  ...spawnEntities(MAP_2, 12, 'AMMO', P1_START_2, P2_START_2),
  ...spawnEntities(MAP_2, 5, 'ARMOR', P1_START_2, P2_START_2),
  { id: 'p_inv', type: 'POWERUP_INVULNERABILITY', pos: { x: 15.5, y: 15.5 }, active: true, textureId: 5 } as Entity,
  { id: 'exit', type: 'EXIT', pos: { x: 27.5, y: 2.5 }, active: true, textureId: 0 } as Entity
];

// Level 3: The Depths (40x40) - Maze-like
const P1_START_3 = { x: 2.5, y: 2.5 };
const P2_START_3 = { x: 37.5, y: 37.5 };
const MAP_3 = createMap(40, 40, 0.25, [P1_START_3, P2_START_3]);
const ENTITIES_3 = [
  ...spawnEntities(MAP_3, 50, 'ENEMY', P1_START_3, P2_START_3),
  ...spawnEntities(MAP_3, 15, 'AMMO', P1_START_3, P2_START_3),
  ...spawnEntities(MAP_3, 5, 'HEALTH', P1_START_3, P2_START_3),
  ...spawnEntities(MAP_3, 8, 'ARMOR', P1_START_3, P2_START_3),
  { id: 'p_quad', type: 'POWERUP_QUAD', pos: { x: 20.5, y: 20.5 }, active: true, textureId: 4 } as Entity,
  { id: 'exit', type: 'EXIT', pos: { x: 35.5, y: 35.5 }, active: true, textureId: 0 } as Entity
];

// Level 4: The Foundry (50x50) - Lava colors
const P1_START_4 = { x: 5.5, y: 5.5 };
const P2_START_4 = { x: 45.5, y: 45.5 };
const MAP_4 = createMap(50, 50, 0.15, [P1_START_4, P2_START_4]);
const ENTITIES_4 = [
  ...spawnEntities(MAP_4, 70, 'ENEMY', P1_START_4, P2_START_4),
  ...spawnEntities(MAP_4, 20, 'AMMO', P1_START_4, P2_START_4),
  ...spawnEntities(MAP_4, 10, 'ARMOR', P1_START_4, P2_START_4),
  { id: 'p_inv', type: 'POWERUP_INVULNERABILITY', pos: { x: 25.5, y: 25.5 }, active: true, textureId: 5 } as Entity,
  { id: 'exit', type: 'EXIT', pos: { x: 45.5, y: 5.5 }, active: true, textureId: 0 } as Entity
];

// Level 5: Hell's Arena (60x60) - Wide open, massive enemy count
const P1_START_5 = { x: 10.5, y: 10.5 };
const P2_START_5 = { x: 50.5, y: 50.5 };
const MAP_5 = createMap(60, 60, 0.08, [P1_START_5, P2_START_5]); // Low density walls, high density enemies
const ENTITIES_5 = [
  ...spawnEntities(MAP_5, 120, 'ENEMY', P1_START_5, P2_START_5),
  ...spawnEntities(MAP_5, 30, 'AMMO', P1_START_5, P2_START_5),
  ...spawnEntities(MAP_5, 15, 'HEALTH', P1_START_5, P2_START_5),
  ...spawnEntities(MAP_5, 15, 'ARMOR', P1_START_5, P2_START_5),
  { id: 'p_quad', type: 'POWERUP_QUAD', pos: { x: 30.5, y: 30.5 }, active: true, textureId: 4 } as Entity,
  { id: 'exit', type: 'EXIT', pos: { x: 30.5, y: 55.5 }, active: true, textureId: 0 } as Entity
];


export const LEVELS: Level[] = [
  {
    id: 1,
    map: MAP_1,
    startPosP1: P1_START_1,
    startPosP2: P2_START_1,
    entities: ENTITIES_1,
    ceilingColor: '#1a1a2e',
    floorColor: '#2e2e3a',
    wallColors: ['#555555', '#4a4e69', '#333333'], // Grey/Tech
  },
  {
    id: 2,
    map: MAP_2,
    startPosP1: P1_START_2,
    startPosP2: P2_START_2,
    entities: ENTITIES_2,
    ceilingColor: '#0f172a',
    floorColor: '#1e293b',
    wallColors: ['#3b82f6', '#1d4ed8', '#60a5fa'], // Blue Tech
  },
  {
    id: 3,
    map: MAP_3,
    startPosP1: P1_START_3,
    startPosP2: P2_START_3,
    entities: ENTITIES_3,
    ceilingColor: '#1a1a1a',
    floorColor: '#2a2a2a',
    wallColors: ['#4ade80', '#166534', '#14532d'], // Green/Toxic
  },
  {
    id: 4,
    map: MAP_4,
    startPosP1: P1_START_4,
    startPosP2: P2_START_4,
    entities: ENTITIES_4,
    ceilingColor: '#2f0909',
    floorColor: '#450a0a',
    wallColors: ['#ef4444', '#991b1b', '#fca5a5'], // Red/Lava
  },
  {
    id: 5,
    map: MAP_5,
    startPosP1: P1_START_5,
    startPosP2: P2_START_5,
    entities: ENTITIES_5,
    ceilingColor: '#000000',
    floorColor: '#7f1d1d',
    wallColors: ['#7f1d1d', '#b91c1c', '#991b1b'], // Blood/Hell
  },
];
