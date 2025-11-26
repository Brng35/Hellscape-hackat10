
import { Player, Level, Entity, Vector2 } from '../types';
import { MOVEMENT_SPEED, ROTATION_SPEED, VIEW_WIDTH, VIEW_HEIGHT } from '../constants';

// BFS Pathfinding Helper
function findPath(map: number[][], start: Vector2, end: Vector2): Vector2[] | undefined {
    if (!map || map.length === 0) return undefined;

    const startX = Math.floor(start.x);
    const startY = Math.floor(start.y);
    const endX = Math.floor(end.x);
    const endY = Math.floor(end.y);
    
    // Safety check for bounds
    if (startY < 0 || startY >= map.length || startX < 0 || startX >= map[0].length) return undefined;
    if (endY < 0 || endY >= map.length || endX < 0 || endX >= map[0].length) return undefined;
    
    if (startX === endX && startY === endY) return [];

    const width = map[0].length;
    const height = map.length;
    const queue: {x: number, y: number, path: Vector2[]}[] = [{x: startX, y: startY, path: []}];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    let iterations = 0;
    // Limit search depth for performance
    const MAX_SEARCH = 200; 

    while (queue.length > 0 && iterations < MAX_SEARCH) {
        iterations++;
        const curr = queue.shift()!;
        
        if (curr.x === endX && curr.y === endY) {
            return curr.path;
        }

        const dirs = [[0,1], [1,0], [0,-1], [-1,0]]; // N, E, S, W
        
        // rudimentary heuristic sorting (A* lite) - prefer directions towards target
        dirs.sort((a,b) => {
             const distA = Math.abs((curr.x + a[0]) - endX) + Math.abs((curr.y + a[1]) - endY);
             const distB = Math.abs((curr.x + b[0]) - endX) + Math.abs((curr.y + b[1]) - endY);
             return distA - distB;
        });

        for (const [dx, dy] of dirs) {
            const nx = curr.x + dx;
            const ny = curr.y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                // Check if walkable (0)
                if (map[ny][nx] === 0) {
                    const key = `${nx},${ny}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        const newPath = [...curr.path, {x: nx + 0.5, y: ny + 0.5}]; // Center of tile
                        queue.push({x: nx, y: ny, path: newPath});
                    }
                }
            }
        }
    }
    return undefined; // No path found in limit
}

export class Engine {
  // Raycasting logic adapted for TypeScript
  static castRays(
    ctx: CanvasRenderingContext2D,
    player: Player,
    otherPlayer: Player | null,
    level: Level,
    width: number,
    height: number
  ) {
    if (!level || !level.map || level.map.length === 0) return;

    // 1. Draw Floor and Ceiling with Gradient for "Depth"
    const ceilingGradient = ctx.createLinearGradient(0, 0, 0, height / 2);
    ceilingGradient.addColorStop(0, '#000000');
    ceilingGradient.addColorStop(1, level.ceilingColor);
    ctx.fillStyle = ceilingGradient;
    ctx.fillRect(0, 0, width, height / 2);

    const floorGradient = ctx.createLinearGradient(0, height / 2, 0, height);
    floorGradient.addColorStop(0, level.floorColor);
    floorGradient.addColorStop(1, '#111111');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(0, height / 2, width, height / 2);

    const zBuffer: number[] = new Array(width).fill(0);

    // 2. Wall Casting
    for (let x = 0; x < width; x++) {
      const cameraX = (2 * x) / width - 1;
      const rayDirX = player.dir.x + player.plane.x * cameraX;
      const rayDirY = player.dir.y + player.plane.y * cameraX;

      let mapX = Math.floor(player.pos.x);
      let mapY = Math.floor(player.pos.y);

      let sideDistX: number;
      let sideDistY: number;

      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);

      let perpWallDist: number = 0;
      let stepX: number;
      let stepY: number;

      let hit = 0;
      let side = 0; // 0 for NS, 1 for EW
      let wallType = 0;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (player.pos.x - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - player.pos.x) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (player.pos.y - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - player.pos.y) * deltaDistY;
      }

      // DDA Loop
      let loopCount = 0;
      while (hit === 0 && loopCount < 100) { // Safety break
        loopCount++;
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }

        if (mapX < 0 || mapX >= level.map[0].length || mapY < 0 || mapY >= level.map.length) {
          hit = 1; // Out of bounds
          perpWallDist = 1000; // Far away
        } else if (level.map[mapY][mapX] > 0) {
          hit = 1;
          wallType = level.map[mapY][mapX];
        }
      }

      if (side === 0) {
        perpWallDist = (mapX - player.pos.x + (1 - stepX) / 2) / rayDirX;
      } else {
        perpWallDist = (mapY - player.pos.y + (1 - stepY) / 2) / rayDirY;
      }

      // CRITICAL FIX: Prevent Infinity or NaN causing rendering crashes
      if (!isFinite(perpWallDist) || perpWallDist <= 0.01) {
          perpWallDist = 0.01;
      }

      zBuffer[x] = perpWallDist;

      const lineHeight = Math.floor(height / perpWallDist);
      let drawStart = -lineHeight / 2 + height / 2;
      let drawEnd = lineHeight / 2 + height / 2;
      
      // Clamp values for rendering safety
      if (drawStart < -10000) drawStart = -10000; 
      if (drawEnd > 10000) drawEnd = 10000;

      let renderStart = Math.max(0, drawStart);
      let renderEnd = Math.min(height, drawEnd);

      // --- TEXTURE CALCULATION ---
      let wallX;
      if (side === 0) wallX = player.pos.y + perpWallDist * rayDirY;
      else           wallX = player.pos.x + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);
      
      let texX = Math.floor(wallX * 64);
      if(side == 0 && rayDirX > 0) texX = 64 - texX - 1;
      if(side == 1 && rayDirY < 0) texX = 64 - texX - 1;

      // Base Color
      const colorIndex = Math.max(0, (wallType - 1) % level.wallColors.length);
      ctx.fillStyle = level.wallColors[colorIndex] || '#fff';
      
      // Only draw if height is reasonable
      if (renderEnd > renderStart) {
        ctx.fillRect(x, renderStart, 1, renderEnd - renderStart);

        // --- PROCEDURAL TEXTURING ---
        // We calculate patterns based on original drawStart/End to keep scale consistent
        // but clamp drawing commands to valid screen area
        
        if (wallType === 1 || wallType === 4) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            if (texX % 32 === 0 || texX % 32 === 31) {
                ctx.fillRect(x, renderStart, 1, renderEnd - renderStart);
            }
            const panelHeight = (drawEnd - drawStart) / 4;
            if (isFinite(panelHeight) && panelHeight > 0) {
                for(let i=1; i<4; i++) {
                   const yPos = drawStart + i * panelHeight;
                   if (yPos >= 0 && yPos < height) {
                       ctx.fillRect(x, yPos, 1, Math.max(1, panelHeight * 0.1));
                   }
                }
            }
            if (texX % 8 === 0) {
                ctx.fillStyle = 'rgba(200,200,200,0.2)';
                const rTop = drawStart + 5;
                const rBot = drawEnd - 7;
                if (rTop >= 0 && rTop < height) ctx.fillRect(x, rTop, 1, 2);
                if (rBot >= 0 && rBot < height) ctx.fillRect(x, rBot, 1, 2);
            }
        }

        if (wallType === 2) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            const gridScale = (drawEnd - drawStart) / 8;
            if (isFinite(gridScale) && gridScale > 1) {
                const yMod = (Math.floor(drawStart) + x) % Math.floor(gridScale);
                if (yMod < 2) {
                   ctx.fillRect(x, renderStart, 1, renderEnd - renderStart);
                }
            }
            if (texX % 16 === 0) {
                ctx.fillStyle = 'rgba(100,200,255,0.1)'; 
                ctx.fillRect(x, renderStart, 1, renderEnd - renderStart);
            }
        }

        if (wallType === 3) {
            if (Math.random() > 0.8) {
               ctx.fillStyle = 'rgba(0,0,0,0.3)';
               const spotH = (renderEnd - renderStart) * 0.1;
               const spotY = renderStart + Math.random() * ((renderEnd - renderStart) - spotH);
               if (spotH > 0) ctx.fillRect(x, spotY, 1, spotH);
            }
            if (texX % 4 === 0) {
               ctx.fillStyle = 'rgba(0,0,0,0.1)';
               ctx.fillRect(x, renderStart, 1, renderEnd - renderStart);
            }
        }

        if (side === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; 
          ctx.fillRect(x, renderStart, 1, renderEnd - renderStart);
        }

        if (perpWallDist > 2) {
            const fogOpacity = Math.min(1, (perpWallDist - 2) / 20); 
            ctx.fillStyle = `rgba(0,0,0,${fogOpacity})`;
            ctx.fillRect(x, renderStart, 1, renderEnd - renderStart);
        }
      }
    }

    // 3. Sprite/Entity Casting
    const renderList: Entity[] = [...level.entities];
    if (otherPlayer) {
        // Render other player, show knocked status visually
        renderList.push({
            id: 'player_other',
            type: 'PLAYER',
            pos: otherPlayer.pos,
            active: true, // Always active to be seen
            textureId: 99,
            health: otherPlayer.health // Pass health to render wounded state if needed
        });
    }

    const MAX_RENDER_DIST = 25; 
    const visibleEntities = renderList.filter(e => {
        if (!e.active && !e.deathAnimation) return false; 
        const distSq = (player.pos.x - e.pos.x)**2 + (player.pos.y - e.pos.y)**2;
        return distSq < MAX_RENDER_DIST * MAX_RENDER_DIST;
    });

    const sortedEntities = visibleEntities.map(e => {
        return {
            ...e,
            dist: ((player.pos.x - e.pos.x) ** 2 + (player.pos.y - e.pos.y) ** 2)
        };
    }).sort((a, b) => b.dist - a.dist);

    for (const ent of sortedEntities) {
        const spriteX = ent.pos.x - player.pos.x;
        const spriteY = ent.pos.y - player.pos.y;

        const det = (player.plane.x * player.dir.y - player.dir.x * player.plane.y);
        if (Math.abs(det) < 0.001) continue; // Prevent div by zero
        
        const invDet = 1.0 / det;
        const transformX = invDet * (player.dir.y * spriteX - player.dir.x * spriteY);
        const transformY = invDet * (-player.plane.y * spriteX + player.plane.x * spriteY); 

        if (transformY <= 0.1) continue; // Clip behind or very close to camera

        const spriteScreenX = Math.floor((width / 2) * (1 + transformX / transformY));

        const scale = (ent.type === 'ENEMY' || ent.type === 'AMMO' || ent.type === 'HEALTH' || ent.type === 'ARMOR' || ent.type.startsWith('POWERUP')) ? 0.6 : 1.0;
        
        const spriteHeight = Math.abs(Math.floor(height / transformY)) * scale;
        const fullHeight = Math.abs(Math.floor(height / transformY));
        const verticalOffset = (fullHeight - spriteHeight) / 2;

        let deathOffset = 0;
        if (ent.deathAnimation) {
             const progress = 1 - (ent.deathAnimation.timer / ent.deathAnimation.duration);
             deathOffset = spriteHeight * progress * 0.8; 
        }

        // Knocked down player sprite check
        let knockedOffset = 0;
        if (ent.type === 'PLAYER' && otherPlayer && ent.pos === otherPlayer.pos && otherPlayer.isKnocked) {
            knockedOffset = spriteHeight * 0.5; // Sink into ground
        }

        let drawStartY = -spriteHeight / 2 + height / 2 + deathOffset + verticalOffset + knockedOffset;
        if (drawStartY < -10000) drawStartY = -10000;
        let drawEndY = spriteHeight / 2 + height / 2 + deathOffset + verticalOffset + knockedOffset;
        if (drawEndY > 10000) drawEndY = 10000;
        
        const renderStartY = Math.max(0, drawStartY);
        const renderEndY = Math.min(height, drawEndY);

        const spriteWidth = Math.abs(Math.floor(height / transformY)) * scale; 
        let drawStartX = -spriteWidth / 2 + spriteScreenX;
        let drawEndX = spriteWidth / 2 + spriteScreenX;
        
        if (spriteWidth > 0 && spriteWidth < 10000) { // Sanity check
            for(let stripe = Math.floor(drawStartX); stripe < Math.floor(drawEndX); stripe++) {
                if (stripe > 0 && stripe < width && transformY < zBuffer[stripe]) {
                    const pixelInSpriteX = stripe - drawStartX;
                    const percentX = pixelInSpriteX / spriteWidth;

                    // --- SPRITE RENDERER ---
                    if (ent.type === 'ENEMY') {
                       // --- 64-BIT DEMON SPRITE ---
                       const baseColor = ent.subType === 'RANGED' ? '#8B0000' : '#A52A2A'; // Dark Red / Brown
                       ctx.fillStyle = baseColor;
                       if (ent.deathAnimation) ctx.fillStyle = '#220000'; 

                       if (renderEndY > renderStartY) {
                           // Head (Broad, horned)
                           if (percentX > 0.3 && percentX < 0.7) {
                               const headTop = drawStartY;
                               const headBot = drawStartY + spriteHeight * 0.25;
                               const rHeadTop = Math.max(renderStartY, headTop);
                               const rHeadBot = Math.min(renderEndY, headBot);
                               
                               if (rHeadBot > rHeadTop) ctx.fillRect(stripe, rHeadTop, 1, rHeadBot - rHeadTop);
                               
                               // Horns
                               if (percentX < 0.4 || percentX > 0.6) {
                                   const hornTop = headTop - spriteHeight * 0.05;
                                   const hornBot = headTop + spriteHeight * 0.05;
                                    const rHT = Math.max(renderStartY, hornTop);
                                    const rHB = Math.min(renderEndY, hornBot);
                                   if(rHB > rHT) {
                                       ctx.fillStyle = '#CCCCCC'; 
                                       ctx.fillRect(stripe, rHT, 1, rHB - rHT);
                                       ctx.fillStyle = baseColor; 
                                   }
                               }
                           }

                           // Torso (Muscular)
                           if (percentX > 0.25 && percentX < 0.75) {
                               const torsoTop = drawStartY + spriteHeight * 0.25;
                               const torsoBot = drawStartY + spriteHeight * 0.6;
                               const rTop = Math.max(renderStartY, torsoTop);
                               const rBot = Math.min(renderEndY, torsoBot);
                               
                               if (rBot > rTop) {
                                   if (percentX > 0.48 && percentX < 0.52) ctx.fillStyle = '#550000'; 
                                   else ctx.fillStyle = baseColor;
                                   ctx.fillRect(stripe, rTop, 1, rBot - rTop);
                               }
                           }

                           // Arms
                           if ((percentX < 0.25 && percentX > 0.1) || (percentX > 0.75 && percentX < 0.9)) {
                               const armTop = drawStartY + spriteHeight * 0.28;
                               const armBot = drawStartY + spriteHeight * 0.65;
                               const rTop = Math.max(renderStartY, armTop);
                               const rBot = Math.min(renderEndY, armBot);
                               
                               if (rBot > rTop) {
                                   ctx.fillStyle = ent.subType === 'MELEE' ? '#aa4444' : '#883333';
                                   ctx.fillRect(stripe, rTop, 1, rBot - rTop);
                               }
                           }

                           // Legs
                           if (percentX > 0.3 && percentX < 0.7) {
                               const legTop = drawStartY + spriteHeight * 0.6;
                               const legBot = drawEndY;
                               const rTop = Math.max(renderStartY, legTop);
                               const rBot = Math.min(renderEndY, legBot);

                               if (rBot > rTop && (percentX < 0.48 || percentX > 0.52)) {
                                   ctx.fillStyle = '#2d1a1a'; 
                                   ctx.fillRect(stripe, rTop, 1, rBot - rTop);
                               }
                           }
                       }
                    } 
                    else if (ent.type === 'PLAYER') {
                        // Space Marine
                        const rTop = renderStartY;
                        const rBot = renderEndY;
                        if (rBot > rTop) {
                             ctx.fillStyle = otherPlayer?.isKnocked ? '#ff0000' : '#1b4d3e';
                             ctx.fillRect(stripe, rTop, 1, rBot - rTop);
                        }
                    } else if (ent.type === 'AMMO' || ent.type === 'POWERUP_QUAD' || ent.type === 'POWERUP_INVULNERABILITY' || ent.type === 'ARMOR') {
                        const isQuad = ent.type === 'POWERUP_QUAD';
                        const isInv = ent.type === 'POWERUP_INVULNERABILITY';
                        const isArmor = ent.type === 'ARMOR';
                        
                        const rTop = renderStartY;
                        const rBot = renderEndY;
                        
                        if (rBot > rTop) {
                            ctx.fillStyle = '#333333';
                            ctx.fillRect(stripe, Math.max(rTop, drawStartY + spriteHeight * 0.2), 1, Math.min(rBot, drawEndY) - Math.max(rTop, drawStartY + spriteHeight * 0.2));
                            
                            const glowColor = isQuad ? '#aa00ff' : (isInv ? '#00ffff' : (isArmor ? '#0099ff' : '#ff0000'));
                            if (percentX > 0.3 && percentX < 0.7) {
                                ctx.fillStyle = glowColor;
                                const gTop = Math.max(rTop, drawStartY + spriteHeight * 0.4);
                                const gBot = Math.min(rBot, drawStartY + spriteHeight * 0.8);
                                if (gBot > gTop) ctx.fillRect(stripe, gTop, 1, gBot - gTop);
                            }
                            if (percentX < 0.1 || percentX > 0.9) {
                                ctx.fillStyle = '#777';
                                ctx.fillRect(stripe, rTop, 1, rBot - rTop); 
                            }
                        }
                    } else if (ent.type === 'HEALTH') {
                        const rTop = Math.max(renderStartY, drawStartY + spriteHeight * 0.5);
                        const rBot = renderEndY;
                        if (rBot > rTop) {
                            ctx.fillStyle = '#0000ff';
                            ctx.fillRect(stripe, rTop, 1, rBot - rTop); 
                        }
                    }
                     else if (ent.type === 'EXIT') {
                        const rTop = renderStartY;
                        const rBot = renderEndY;
                        if (rBot > rTop) {
                            if (percentX < 0.1 || percentX > 0.9 || (drawEndY - drawStartY) * percentX < 0.1) {
                                 ctx.fillStyle = '#444';
                                 ctx.fillRect(stripe, rTop, 1, rBot - rTop);
                            } else {
                                const flicker = Math.random();
                                ctx.fillStyle = `rgba(${255 * flicker}, 0, 0, 0.8)`;
                                ctx.fillRect(stripe, rTop, 1, rBot - rTop);
                            }
                        }
                    } 
                }
            }
        }
    }
  }

  // --- LINE OF SIGHT CHECK ---
  static checkLineOfSight(level: Level, p1: Vector2, p2: Vector2): boolean {
      const x0 = p1.x;
      const y0 = p1.y;
      const x1 = p2.x;
      const y1 = p2.y;

      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = (x0 < x1) ? 1 : -1;
      const sy = (y0 < y1) ? 1 : -1;
      let err = dx - dy;

      let cx = Math.floor(x0);
      let cy = Math.floor(y0);
      const endX = Math.floor(x1);
      const endY = Math.floor(y1);

      let maxSteps = 40; 

      while (true) {
          if (cx === endX && cy === endY) return true;
          if (level.map[cy] && level.map[cy][cx] !== 0) return false; 

          if (maxSteps-- <= 0) return false;

          const e2 = 2 * err;
          if (e2 > -dy) {
              err -= dy;
              cx += sx;
          }
          if (e2 < dx) {
              err += dx;
              cy += sy;
          }
      }
  }

  static updatePlayer(player: Player, keys: Set<string>, level: Level, dt: number, otherPlayer: Player) {
    if (player.isKnocked) return; // Cannot move if knocked
    if (player.health <= 0) return; // Should be handled by knocked state, but double check

    const moveSpeed = MOVEMENT_SPEED * dt;
    const rotSpeed = ROTATION_SPEED * dt;
    const COLLISION_PADDING = 0.3; 

    let moveStep = 0;
    let rotStep = 0;

    // Input mapping
    if (player.id === 1) {
        if (keys.has('w')) moveStep = 1;
        if (keys.has('s')) moveStep = -1;
        if (keys.has('a')) rotStep = 1; 
        if (keys.has('d')) rotStep = -1; 
    } else {
        if (keys.has('arrowup')) moveStep = 1;
        if (keys.has('arrowdown')) moveStep = -1;
        if (keys.has('arrowleft')) rotStep = 1; 
        if (keys.has('arrowright')) rotStep = -1; 
    }

    // Rotation
    if (rotStep !== 0) {
        const oldDirX = player.dir.x;
        player.dir.x = player.dir.x * Math.cos(rotStep * rotSpeed) - player.dir.y * Math.sin(rotStep * rotSpeed);
        player.dir.y = oldDirX * Math.sin(rotStep * rotSpeed) + player.dir.y * Math.cos(rotStep * rotSpeed);
        const oldPlaneX = player.plane.x;
        player.plane.x = player.plane.x * Math.cos(rotStep * rotSpeed) - player.plane.y * Math.sin(rotStep * rotSpeed);
        player.plane.y = oldPlaneX * Math.sin(rotStep * rotSpeed) + player.plane.y * Math.cos(rotStep * rotSpeed);
    }

    // Robust Collision Detection
    if (moveStep !== 0) {
        const moveX = player.dir.x * moveStep * moveSpeed;
        const moveY = player.dir.y * moveStep * moveSpeed;

        const distToOther = Math.sqrt((player.pos.x + moveX - otherPlayer.pos.x)**2 + (player.pos.y + moveY - otherPlayer.pos.y)**2);
        const playersCollide = !otherPlayer.isKnocked && otherPlayer.health > 0 && distToOther < 0.6;

        if (!playersCollide) {
            const nextX = player.pos.x + moveX;
            let canMoveX = true;
            
            const xOffset = moveX > 0 ? COLLISION_PADDING : -COLLISION_PADDING;
            const mapGridX = Math.floor(nextX + xOffset);
            const mapGridY = Math.floor(player.pos.y);

            // Safety Check
            if (mapGridY >= 0 && mapGridY < level.map.length && mapGridX >= 0 && mapGridX < level.map[0].length) {
                if (level.map[mapGridY] && level.map[mapGridY][mapGridX] !== 0) {
                    canMoveX = false;
                }
            } else {
                canMoveX = false;
            }

            if (canMoveX) {
                player.pos.x = nextX;
            }

            const nextY = player.pos.y + moveY;
            let canMoveY = true;
            
            const yOffset = moveY > 0 ? COLLISION_PADDING : -COLLISION_PADDING;
            const mapGridYNew = Math.floor(nextY + yOffset);
            const mapGridXCurrent = Math.floor(player.pos.x);

            if (mapGridYNew >= 0 && mapGridYNew < level.map.length && mapGridXCurrent >= 0 && mapGridXCurrent < level.map[0].length) {
                if (level.map[mapGridYNew] && level.map[mapGridYNew][mapGridXCurrent] !== 0) {
                    canMoveY = false;
                }
            } else {
                canMoveY = false;
            }

            if (canMoveY) {
                player.pos.y = nextY;
            }
        }
    }
    
    // Update Fog of War
    const pX = Math.floor(player.pos.x);
    const pY = Math.floor(player.pos.y);
    const radius = 3; 
    for(let fy = pY - radius; fy <= pY + radius; fy++) {
        for(let fx = pX - radius; fx <= pX + radius; fx++) {
            if (fy >= 0 && fy < level.map.length && fx >= 0 && fx < level.map[0].length) {
                const key = `${fx},${fy}`;
                if (!player.visitedTiles.includes(key)) {
                    player.visitedTiles.push(key);
                }
            }
        }
    }

    if (player.weaponTimer > 0) player.weaponTimer -= dt;

    level.entities.forEach(ent => {
        if (!ent.active) return;
        const distSq = (player.pos.x - ent.pos.x)**2 + (player.pos.y - ent.pos.y)**2;
        
        if (distSq < 0.5) { 
            if (ent.type === 'AMMO') {
                player.ammo += 20;
                ent.active = false;
            } else if (ent.type === 'HEALTH' && player.health < 100) {
                player.health = Math.min(100, player.health + 25);
                ent.active = false;
            } else if (ent.type === 'ARMOR' && player.shield < player.maxShield) {
                player.shield = Math.min(player.maxShield, player.shield + 25);
                ent.active = false;
            } else if (ent.type === 'POWERUP_QUAD') {
                player.activePowerups.QUAD_DAMAGE = 10000; 
                ent.active = false;
            } else if (ent.type === 'POWERUP_INVULNERABILITY') {
                player.activePowerups.INVULNERABILITY = 10000;
                ent.active = false;
            }
        }
    });
  }

  static updateEnemies(level: Level, players: {1: Player, 2: Player}, dt: number) {
      const now = performance.now();

      level.entities.forEach(ent => {
          if (ent.deathAnimation) {
              ent.deathAnimation.timer -= dt;
              if (ent.deathAnimation.timer <= 0) {
                  ent.deathAnimation = undefined;
                  ent.active = false; 
              }
              return; 
          }

          if (!ent.active) return;
          
          if (ent.type === 'ENEMY') {
              if (ent.health !== undefined && ent.health <= 0) {
                  ent.deathAnimation = { timer: 0.5, duration: 0.5 };
                  return;
              }

              const p1 = players[1];
              const p2 = players[2];
              
              // Ignore knocked players unless both are knocked (in which case game over handles it)
              const p1Targetable = !p1.isKnocked && p1.health > 0;
              const p2Targetable = !p2.isKnocked && p2.health > 0;

              if (!p1Targetable && !p2Targetable) return;

              const d1 = p1Targetable ? (p1.pos.x - ent.pos.x)**2 + (p1.pos.y - ent.pos.y)**2 : Infinity;
              const d2 = p2Targetable ? (p2.pos.x - ent.pos.x)**2 + (p2.pos.y - ent.pos.y)**2 : Infinity;
              
              let target: Player;
              let distSq: number;

              if (d1 < d2) {
                  target = p1;
                  distSq = d1;
              } else {
                  target = p2;
                  distSq = d2;
              }

              if (distSq === Infinity) return;

              const dist = Math.sqrt(distSq);
              const checkDist = 15;
              let hasLOS = false;
              if (dist < checkDist) {
                   hasLOS = Engine.checkLineOfSight(level, ent.pos, target.pos);
              }

              // --- AI LOGIC UPDATE ---
              if (ent.health && ent.health < 20 && Math.random() < 0.01) {
                  ent.aiState = 'RETREAT';
              } else if (hasLOS && dist < 12) {
                  ent.aiState = 'CHASE';
                  if (ent.subType === 'RANGED' && dist < 6 && dist > 2) {
                      ent.aiState = 'ATTACK';
                  } else if (ent.subType === 'MELEE' && dist < 1.0) {
                      ent.aiState = 'ATTACK';
                  }
              } else if (!hasLOS && ent.aiState === 'CHASE') {
                  if (dist > 20) ent.aiState = 'IDLE';
              }

              if (ent.aiState === 'CHASE') {
                  const moveSpeed = (ent.subType === 'MELEE' ? 2.8 : 1.8) * dt;
                  
                  if (hasLOS) {
                      let dx = target.pos.x - ent.pos.x;
                      let dy = target.pos.y - ent.pos.y;
                      const len = Math.sqrt(dx*dx + dy*dy);
                      dx /= len;
                      dy /= len;

                      const nextX = ent.pos.x + dx * moveSpeed;
                      const nextY = ent.pos.y + dy * moveSpeed;

                      if (level.map[Math.floor(ent.pos.y)][Math.floor(nextX)] === 0) ent.pos.x = nextX;
                      if (level.map[Math.floor(nextY)][Math.floor(ent.pos.x)] === 0) ent.pos.y = nextY;
                  } else {
                      if (!ent.path || !ent.lastPathTime || (now - ent.lastPathTime > 500)) {
                          ent.path = findPath(level.map, ent.pos, target.pos);
                          ent.lastPathTime = now;
                      }

                      if (ent.path && ent.path.length > 0) {
                          const nextNode = ent.path[0];
                          let dx = nextNode.x - ent.pos.x;
                          let dy = nextNode.y - ent.pos.y;
                          const len = Math.sqrt(dx*dx + dy*dy);
                          
                          if (len < 0.1) {
                              ent.path.shift(); // Reached node
                          } else {
                              dx /= len;
                              dy /= len;
                              ent.pos.x += dx * moveSpeed;
                              ent.pos.y += dy * moveSpeed;
                          }
                      }
                  }

              } else if (ent.aiState === 'RETREAT') {
                   const moveSpeed = 2.0 * dt;
                   const dx = ent.pos.x - target.pos.x;
                   const dy = ent.pos.y - target.pos.y;
                   const len = Math.sqrt(dx*dx + dy*dy);
                   
                   const nextX = ent.pos.x + (dx/len) * moveSpeed;
                   const nextY = ent.pos.y + (dy/len) * moveSpeed;
                   
                   if (level.map[Math.floor(ent.pos.y)][Math.floor(nextX)] === 0) ent.pos.x = nextX;
                   if (level.map[Math.floor(nextY)][Math.floor(ent.pos.x)] === 0) ent.pos.y = nextY;

              } else if (ent.aiState === 'ATTACK') {
                  const isInvulnerable = target.activePowerups.INVULNERABILITY && target.activePowerups.INVULNERABILITY > 0;
                  
                  // Reduced damage values
                  const MELEE_DAMAGE = 10;
                  const RANGED_DAMAGE = 8;
                  
                  if (ent.subType === 'MELEE') {
                      if (dist < 1.2 && !isInvulnerable) {
                          // Apply Damage to Shield First
                          let damage = MELEE_DAMAGE * dt;
                          if (target.shield > 0) {
                              const absorb = Math.min(target.shield, damage);
                              target.shield -= absorb;
                              damage -= absorb;
                          }
                          target.health -= damage;
                          if (target.health <= 0) {
                              target.isKnocked = true;
                              target.health = 0;
                          }
                      } else if (dist >= 1.2) {
                          ent.aiState = 'CHASE';
                      }
                  } 
                  else if (ent.subType === 'RANGED') {
                      if ((!ent.lastAttackTime || now - ent.lastAttackTime > 2000) && !isInvulnerable) {
                          let damage = RANGED_DAMAGE;
                          if (target.shield > 0) {
                              const absorb = Math.min(target.shield, damage);
                              target.shield -= absorb;
                              damage -= absorb;
                          }
                          target.health -= damage;
                           if (target.health <= 0) {
                              target.isKnocked = true;
                              target.health = 0;
                          }
                          ent.lastAttackTime = now;
                      }
                      
                      if (dist < 3) {
                           const moveSpeed = 1.0 * dt;
                           const dx = ent.pos.x - target.pos.x;
                           const dy = ent.pos.y - target.pos.y;
                           const len = Math.sqrt(dx*dx + dy*dy);
                           const nextX = ent.pos.x + (dx/len) * moveSpeed;
                           const nextY = ent.pos.y + (dy/len) * moveSpeed;
                           if (level.map[Math.floor(ent.pos.y)][Math.floor(nextX)] === 0) ent.pos.x = nextX;
                           if (level.map[Math.floor(nextY)][Math.floor(ent.pos.x)] === 0) ent.pos.y = nextY;
                      }
                  }
              }
          }
      });
  }
}
