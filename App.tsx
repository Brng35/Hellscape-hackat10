
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, Player, Keys, Level, WeaponType } from './types';
import { Engine } from './services/Engine';
import { LEVELS } from './levels';
import { VIEW_WIDTH, VIEW_HEIGHT, WEAPONS } from './constants';
import { Activity, Skull, Zap, Crosshair, Shield, ZapOff, Settings, Keyboard, ArrowLeft, HeartHandshake } from 'lucide-react';

// INITIAL VECTORS FIXED: Plane Y inverted to fix mirroring issues
const INITIAL_PLAYER_1: Player = {
  id: 1,
  pos: { x: 0, y: 0 },
  dir: { x: -1, y: 0 }, 
  plane: { x: 0, y: -0.66 }, 
  health: 100,
  shield: 0,
  maxShield: 100,
  isKnocked: false,
  ammo: 50,
  weaponTimer: 0,
  score: 0,
  currentWeaponIndex: 1, 
  weapons: ['CROWBAR', 'PISTOL', 'SHOTGUN'],
  activePowerups: {},
  visitedTiles: []
};

const INITIAL_PLAYER_2: Player = {
  id: 2,
  pos: { x: 0, y: 0 },
  dir: { x: 1, y: 0 }, 
  plane: { x: 0, y: 0.66 }, 
  health: 100,
  shield: 0,
  maxShield: 100,
  isKnocked: false,
  ammo: 50,
  weaponTimer: 0,
  score: 0,
  currentWeaponIndex: 1, 
  weapons: ['CROWBAR', 'PISTOL', 'SHOTGUN'],
  activePowerups: {},
  visitedTiles: []
};

function App() {
  const [gameState, setGameState] = useState<'MENU' | 'SETTINGS' | 'PLAYING' | 'GAMEOVER' | 'VICTORY'>('MENU');
  const [levelIndex, setLevelIndex] = useState(0);
  // Volume state kept for audioRef but removed from UI
  const [volume, setVolume] = useState(0.5);
  
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const minimap1Ref = useRef<HTMLCanvasElement>(null);
  const minimap2Ref = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const prevHealthRef = useRef({ 1: 100, 2: 100 });
  const [damageFlash, setDamageFlash] = useState({ 1: 0, 2: 0 }); 
  const [isTogether, setIsTogether] = useState(false);
  
  const stateRef = useRef<{
    players: { 1: Player; 2: Player };
    level: Level;
  }>({
    players: { 1: { ...INITIAL_PLAYER_1 }, 2: { ...INITIAL_PLAYER_2 } },
    level: LEVELS[0]
  });

  const [hudState, setHudState] = useState({
    p1: { health: 100, shield: 0, ammo: 50, score: 0, weapon: 'PISTOL', powerups: {} as any, isKnocked: false },
    p2: { health: 100, shield: 0, ammo: 50, score: 0, weapon: 'PISTOL', powerups: {} as any, isKnocked: false }
  });

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysPressed.current.add(e.key.toLowerCase()); // Fix: Normalize keys to lowercase
    
    if (gameState !== 'PLAYING') return;

    if (e.key === ' ') fireWeapon(1);
    if (e.key.toLowerCase() === 'z') switchWeapon(1);
    if (e.key === '-') fireWeapon(2);
    if (e.key === '=' || e.key === '+') switchWeapon(2);

    // Backdoor Cheat: Ctrl + L
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        const nextIdx = levelIndex + 1;
        if (nextIdx >= LEVELS.length) {
            setGameState('VICTORY');
        } else {
            setLevelIndex(nextIdx);
            loadLevel(nextIdx);
        }
    }
  }, [gameState, levelIndex]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysPressed.current.delete(e.key.toLowerCase()); // Fix: Normalize
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const switchWeapon = (playerId: 1 | 2) => {
      const p = stateRef.current.players[playerId];
      if (p.isKnocked) return;
      p.currentWeaponIndex = (p.currentWeaponIndex + 1) % p.weapons.length;
  }

  const fireWeapon = (playerId: 1 | 2) => {
      const state = stateRef.current;
      const player = state.players[playerId];
      
      if (player.isKnocked || player.health <= 0) return;

      const weaponType = player.weapons[player.currentWeaponIndex];
      const weaponStats = WEAPONS[weaponType];
      
      if (player.weaponTimer > 0) return;
      if (weaponStats.ammoCost > 0 && player.ammo < weaponStats.ammoCost) return; 
      
      player.ammo -= weaponStats.ammoCost;
      player.weaponTimer = weaponStats.cooldown; 

      const damageMultiplier = player.activePowerups.QUAD_DAMAGE && player.activePowerups.QUAD_DAMAGE > 0 ? 4 : 1;

      state.level.entities.forEach(ent => {
          if ((!ent.active && !ent.deathAnimation) || ent.type !== 'ENEMY') return;

          const dx = ent.pos.x - player.pos.x;
          const dy = ent.pos.y - player.pos.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          const tx = dx / dist;
          const ty = dy / dist;
          
          const dot = player.dir.x * tx + player.dir.y * ty;
          
          const precision = weaponType === 'SHOTGUN' ? 0.85 : 0.95; 

          if (dot > precision && dist < weaponStats.range) {
              if (ent.health && ent.health > 0) {
                  let dmg = weaponStats.damage * damageMultiplier;
                  
                  if (weaponType === 'SHOTGUN') {
                      dmg = dmg * (1 - (dist / weaponStats.range) * 0.5);
                  }

                  ent.health -= dmg;
                  ent.aiState = 'CHASE'; 
                  
                  if (ent.health <= 0) {
                      player.score += 100;
                  }
              }
          }
      });
  };

  const loadLevel = (index: number) => {
      setDamageFlash({1: 0, 2: 0}); 
      
      const level = JSON.parse(JSON.stringify(LEVELS[index])); 
      stateRef.current.level = level;
      
      const p1 = stateRef.current.players[1];
      p1.pos = { ...level.startPosP1 };
      p1.dir = { x: -1, y: 0 };
      p1.plane = { x: 0, y: -0.66 }; 
      p1.activePowerups = {};
      p1.visitedTiles = [];
      p1.health = 100; 
      p1.isKnocked = false;
      
      const p2 = stateRef.current.players[2];
      p2.pos = { ...level.startPosP2 };
      p2.dir = { x: 1, y: 0 };
      p2.plane = { x: 0, y: 0.66 }; 
      p2.activePowerups = {};
      p2.visitedTiles = [];
      p2.health = 100;
      p2.isKnocked = false;
  };

  const startGame = () => {
      setDamageFlash({1: 0, 2: 0});
      stateRef.current.players = {
          1: JSON.parse(JSON.stringify(INITIAL_PLAYER_1)),
          2: JSON.parse(JSON.stringify(INITIAL_PLAYER_2))
      };
      
      loadLevel(0);
      setLevelIndex(0);
      previousTimeRef.current = undefined; // Reset time to prevent large delta
      setGameState('PLAYING');
      
      // Removed manual requestAnimationFrame here to avoid closure staleness issues.
      // useEffect will pick up the 'PLAYING' state and start the loop correctly.

      if(audioRef.current) {
          audioRef.current.play().catch(e => console.log("Audio autoplay prevented"));
      }
  };

  const drawMinimap = (ctx: CanvasRenderingContext2D, player: Player, level: Level) => {
      const mapW = level.map[0].length;
      const mapH = level.map.length;
      const scale = Math.min(128 / mapW, 128 / mapH); 
      
      ctx.clearRect(0,0, 128, 128);
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0, 128, 128);

      for(let y=0; y<mapH; y++) {
          for(let x=0; x<mapW; x++) {
              const key = `${x},${y}`;
              const isVisited = player.visitedTiles.includes(key);
              
              if (isVisited) {
                  const wall = level.map[y][x];
                  if (wall > 0) {
                      ctx.fillStyle = '#555';
                  } else {
                      ctx.fillStyle = '#222';
                  }
                  ctx.fillRect(x*scale, y*scale, scale, scale);
              }
          }
      }

      level.entities.forEach(ent => {
          if (!ent.active) return;
          const key = `${Math.floor(ent.pos.x)},${Math.floor(ent.pos.y)}`;
          if (player.visitedTiles.includes(key)) {
              if (ent.type === 'ENEMY') ctx.fillStyle = '#f00';
              else if (ent.type === 'EXIT') ctx.fillStyle = '#fff';
              else if (ent.type === 'ARMOR') ctx.fillStyle = '#0ff';
              else ctx.fillStyle = '#ff0';
              ctx.fillRect(ent.pos.x * scale - 1, ent.pos.y * scale - 1, 3, 3);
          }
      });

      // Draw Self
      ctx.fillStyle = player.isKnocked ? '#f00' : '#0f0';
      ctx.beginPath();
      ctx.arc(player.pos.x * scale, player.pos.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
  };

  const animate = (time: number) => {
    if (gameState !== 'PLAYING') return;
    
    try {
        if (previousTimeRef.current === undefined) {
          previousTimeRef.current = time;
        }
        const deltaTime = Math.min(0.1, (time - previousTimeRef.current) / 1000); // Cap delta time to 0.1s to prevent huge jumps
        previousTimeRef.current = time;

        const state = stateRef.current;
        const p1 = state.players[1];
        const p2 = state.players[2];
        
        // --- Stronger Together Logic ---
        const distSq = (p1.pos.x - p2.pos.x)**2 + (p1.pos.y - p2.pos.y)**2;
        const together = distSq < 25; // Within 5 units (5^2 = 25)
        setIsTogether(together);

        if (together && !p1.isKnocked && !p2.isKnocked) {
            // Passive Shield Regen (Max 50)
            if (p1.shield < 50) p1.shield = Math.min(50, p1.shield + 2 * deltaTime);
            if (p2.shield < 50) p2.shield = Math.min(50, p2.shield + 2 * deltaTime);
        }

        // --- Revive Logic ---
        if (keysPressed.current.has('v')) {
            if (together) {
                if (p1.isKnocked && !p2.isKnocked) {
                    p1.isKnocked = false;
                    p1.health = 50;
                }
                if (p2.isKnocked && !p1.isKnocked) {
                    p2.isKnocked = false;
                    p2.health = 50;
                }
            }
        }

        [1, 2].forEach((pid) => {
            const p = state.players[pid as 1|2];
            if (p.activePowerups.QUAD_DAMAGE && p.activePowerups.QUAD_DAMAGE > 0) {
                p.activePowerups.QUAD_DAMAGE -= deltaTime * 1000;
            }
            if (p.activePowerups.INVULNERABILITY && p.activePowerups.INVULNERABILITY > 0) {
                p.activePowerups.INVULNERABILITY -= deltaTime * 1000;
            }
        });

        Engine.updatePlayer(state.players[1], keysPressed.current, state.level, deltaTime, state.players[2]);
        Engine.updatePlayer(state.players[2], keysPressed.current, state.level, deltaTime, state.players[1]);

        Engine.updateEnemies(state.level, state.players, deltaTime);
        
        if (state.players[1].health < prevHealthRef.current[1]) {
            setDamageFlash(prev => ({ ...prev, 1: 0.8 }));
        }
        if (state.players[2].health < prevHealthRef.current[2]) {
            setDamageFlash(prev => ({ ...prev, 2: 0.8 }));
        }
        prevHealthRef.current[1] = state.players[1].health;
        prevHealthRef.current[2] = state.players[2].health;

        setDamageFlash(prev => ({ 
            1: Math.max(0, prev[1] - deltaTime * 2), 
            2: Math.max(0, prev[2] - deltaTime * 2) 
        }));
        
        state.level.entities.forEach(ent => {
           if (!ent.active || ent.type !== 'EXIT') return;
            const d1 = (state.players[1].pos.x - ent.pos.x)**2 + (state.players[1].pos.y - ent.pos.y)**2;
            const d2 = (state.players[2].pos.x - ent.pos.x)**2 + (state.players[2].pos.y - ent.pos.y)**2;
            if (d1 < 1.5 || d2 < 1.5) {
                 const nextIdx = levelIndex + 1;
                 if (nextIdx >= LEVELS.length) {
                     setGameState('VICTORY');
                 } else {
                     setLevelIndex(nextIdx);
                     loadLevel(nextIdx);
                 }
             }
        });

        // Game Over only if BOTH are knocked
        if (state.players[1].isKnocked && state.players[2].isKnocked) {
            setGameState('GAMEOVER');
            return;
        }
        
        if (canvas1Ref.current && canvas2Ref.current) {
            const ctx1 = canvas1Ref.current.getContext('2d');
            const ctx2 = canvas2Ref.current.getContext('2d');
            
            if (ctx1 && ctx2) {
                ctx1.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
                ctx2.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
                
                Engine.castRays(ctx1, state.players[1], state.players[2], state.level, VIEW_WIDTH, VIEW_HEIGHT);
                Engine.castRays(ctx2, state.players[2], state.players[1], state.level, VIEW_WIDTH, VIEW_HEIGHT);
                
                const bob1 = (keysPressed.current.has('w') || keysPressed.current.has('s') || keysPressed.current.has('a') || keysPressed.current.has('d')) && !p1.isKnocked
                             ? Math.sin(time / 150) * 10 : 0;
                const bob2 = (keysPressed.current.has('arrowup') || keysPressed.current.has('arrowdown') || keysPressed.current.has('arrowleft') || keysPressed.current.has('arrowright')) && !p2.isKnocked
                             ? Math.sin(time / 150) * 10 : 0;

                const w1 = state.players[1].weapons[state.players[1].currentWeaponIndex];
                const w2 = state.players[2].weapons[state.players[2].currentWeaponIndex];
                const wStats1 = WEAPONS[w1];
                const wStats2 = WEAPONS[w2];

                const isFiring1 = state.players[1].weaponTimer > 0 && (wStats1.cooldown - state.players[1].weaponTimer) < 0.1;
                const isFiring2 = state.players[2].weaponTimer > 0 && (wStats2.cooldown - state.players[2].weaponTimer) < 0.1;
                
                if (!p1.isKnocked) drawWeapon(ctx1, w1, isFiring1, !!state.players[1].activePowerups.QUAD_DAMAGE, bob1);
                else drawKnockedOverlay(ctx1, "WAITING FOR ASSISTANCE...");

                if (!p2.isKnocked) drawWeapon(ctx2, w2, isFiring2, !!state.players[2].activePowerups.QUAD_DAMAGE, bob2);
                else drawKnockedOverlay(ctx2, "WAITING FOR ASSISTANCE...");
                
                if (damageFlash[1] > 0) {
                    ctx1.fillStyle = `rgba(255, 0, 0, ${damageFlash[1]})`;
                    ctx1.fillRect(0,0, VIEW_WIDTH, VIEW_HEIGHT);
                }
                if (damageFlash[2] > 0) {
                    ctx2.fillStyle = `rgba(255, 0, 0, ${damageFlash[2]})`;
                    ctx2.fillRect(0,0, VIEW_WIDTH, VIEW_HEIGHT);
                }

                // Revive Prompt
                if (together && p2.isKnocked && !p1.isKnocked) drawRevivePrompt(ctx1);
                if (together && p1.isKnocked && !p2.isKnocked) drawRevivePrompt(ctx2);
            }
        }

        if (minimap1Ref.current && minimap2Ref.current) {
            const mCtx1 = minimap1Ref.current.getContext('2d');
            const mCtx2 = minimap2Ref.current.getContext('2d');
            if (mCtx1) drawMinimap(mCtx1, state.players[1], state.level);
            if (mCtx2) drawMinimap(mCtx2, state.players[2], state.level);
        }
        
        setHudState({
            p1: { 
                health: Math.max(0, Math.floor(state.players[1].health)),
                shield: Math.max(0, Math.floor(state.players[1].shield)),
                ammo: state.players[1].ammo, 
                score: state.players[1].score,
                weapon: state.players[1].weapons[state.players[1].currentWeaponIndex],
                powerups: state.players[1].activePowerups,
                isKnocked: state.players[1].isKnocked
            },
            p2: { 
                health: Math.max(0, Math.floor(state.players[2].health)), 
                shield: Math.max(0, Math.floor(state.players[2].shield)),
                ammo: state.players[2].ammo, 
                score: state.players[2].score,
                weapon: state.players[2].weapons[state.players[2].currentWeaponIndex],
                powerups: state.players[2].activePowerups,
                isKnocked: state.players[2].isKnocked
            },
        });
    } catch (e) {
        console.error("Game Loop Error:", e);
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  const drawRevivePrompt = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#0f0';
      ctx.font = 'bold 20px Courier New';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText("PRESS 'V' TO REVIVE PARTNER", VIEW_WIDTH/2, VIEW_HEIGHT/2 + 50);
      ctx.shadowBlur = 0;
  };

  const drawKnockedOverlay = (ctx: CanvasRenderingContext2D, text: string) => {
      ctx.fillStyle = 'rgba(100, 0, 0, 0.5)';
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText("CRITICAL INJURY", VIEW_WIDTH/2, VIEW_HEIGHT/2 - 20);
      ctx.font = '16px Courier New';
      ctx.fillText(text, VIEW_WIDTH/2, VIEW_HEIGHT/2 + 20);
  };

  const drawDeathOverlay = (ctx: CanvasRenderingContext2D) => {
      const gradient = ctx.createRadialGradient(VIEW_WIDTH/2, VIEW_HEIGHT/2, VIEW_HEIGHT/4, VIEW_WIDTH/2, VIEW_HEIGHT/2, VIEW_WIDTH);
      gradient.addColorStop(0, 'rgba(100, 0, 0, 0.2)');
      gradient.addColorStop(1, 'rgba(50, 0, 0, 0.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      ctx.fillStyle = `rgba(0,0,0, ${Math.random() * 0.2})`;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 36px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('CRITICAL FAILURE', VIEW_WIDTH/2, VIEW_HEIGHT/2);
  };

  const drawWeapon = (ctx: CanvasRenderingContext2D, type: WeaponType, isFiring: boolean, isQuad: boolean, bobY: number) => {
      const cx = VIEW_WIDTH / 2;
      const h = VIEW_HEIGHT + bobY;

      if (isQuad) {
          ctx.shadowColor = '#aa00ff';
          ctx.shadowBlur = 20;
      } else {
          ctx.shadowBlur = 0;
      }
      
      if (type === 'CROWBAR') {
          // 64-bit Pixel Art Crowbar
          const tilt = isFiring ? -30 : -10; 
          ctx.save();
          ctx.translate(cx + 60, h - 80);
          ctx.rotate(tilt * Math.PI / 180);
          
          // Draw Main Shaft
          ctx.fillStyle = '#7a7a7a'; // Lighter Grey
          ctx.fillRect(-10, -150, 20, 180);
          ctx.fillStyle = '#4a4a4a'; // Shading
          ctx.fillRect(5, -150, 5, 180);
          
          // Draw Red Grip
          ctx.fillStyle = '#800000';
          ctx.fillRect(-12, -50, 24, 60);
          
          // Draw Hook Head
          ctx.beginPath();
          ctx.moveTo(-10, -150);
          ctx.lineTo(-40, -180);
          ctx.lineTo(-30, -190);
          ctx.lineTo(10, -150);
          ctx.fillStyle = '#9a9a9a';
          ctx.fill();

          ctx.restore();

      } else if (type === 'SHOTGUN') {
           // 64-bit Pump Action Shotgun
           const recoil = isFiring ? 20 : 0;
           const weaponY = h - 100 + recoil;
           
           // Stock
           ctx.fillStyle = '#5d4037'; // Wood
           ctx.fillRect(cx - 10, weaponY + 50, 20, 60);
           
           // Body
           ctx.fillStyle = '#212121'; // Dark Metal
           ctx.fillRect(cx - 15, weaponY, 30, 80);
           
           // Barrels (Double barrel look)
           const grad = ctx.createLinearGradient(cx - 20, weaponY, cx + 20, weaponY);
           grad.addColorStop(0, '#111');
           grad.addColorStop(0.5, '#444');
           grad.addColorStop(1, '#111');
           ctx.fillStyle = grad;
           ctx.fillRect(cx - 12, weaponY - 80, 10, 80); // Left barrel
           ctx.fillRect(cx + 2, weaponY - 80, 10, 80); // Right barrel

           // Pump handle
           ctx.fillStyle = '#3e2723';
           ctx.fillRect(cx - 14, weaponY - 60, 28, 30);

           if (isFiring) {
              const flashSize = 40 + Math.random() * 20; 
              ctx.fillStyle = isQuad ? '#aa00ff' : '#ffaa00';
              ctx.beginPath();
              ctx.arc(cx - 7, weaponY - 90, flashSize, 0, Math.PI * 2);
              ctx.arc(cx + 7, weaponY - 90, flashSize, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = '#ffff00';
              ctx.beginPath();
              ctx.arc(cx, weaponY - 90, flashSize * 0.7, 0, Math.PI * 2);
              ctx.fill();
           }

      } else {
          // 64-bit Magnum Pistol
          const recoil = isFiring ? 15 : 0;
          const weaponY = h - 110 + recoil;

          // Grip
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(cx - 10, weaponY + 40, 20, 60);
          
          // Slide/Barrel
          const grad = ctx.createLinearGradient(cx - 15, 0, cx + 15, 0);
          grad.addColorStop(0, '#777'); // Silver
          grad.addColorStop(0.5, '#eee'); // Shine
          grad.addColorStop(1, '#777');
          ctx.fillStyle = grad;
          ctx.fillRect(cx - 8, weaponY - 20, 16, 80); // Long barrel
          
          // Muzzle
          ctx.fillStyle = '#000';
          ctx.fillRect(cx - 5, weaponY - 25, 10, 5);

          if (isFiring) {
              const flashSize = 25 + Math.random() * 10;
              ctx.fillStyle = isQuad ? '#aa00ff' : '#ffaa00';
              ctx.beginPath();
              ctx.arc(cx, weaponY - 35, flashSize, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(cx, weaponY - 35, flashSize * 0.5, 0, Math.PI * 2);
              ctx.fill();
          }
      }
      
      // Crosshair
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 5, VIEW_HEIGHT/2);
      ctx.lineTo(cx + 5, VIEW_HEIGHT/2);
      ctx.moveTo(cx, VIEW_HEIGHT/2 - 5);
      ctx.lineTo(cx, VIEW_HEIGHT/2 + 5);
      ctx.stroke();
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      previousTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, levelIndex]);

  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white overflow-hidden relative font-mono">
      {/* Audio Element */}
      <audio ref={audioRef} src="music.mp3" loop />
      
      {/* Dynamic Hell Background */}
      <div className="absolute inset-0 z-0 opacity-50 pointer-events-none" style={{
          background: 'radial-gradient(circle at center, #500 0%, #000 100%)',
          animation: 'pulse 4s infinite'
      }}>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150"></div>
      </div>
      <style>{`
        @keyframes pulse {
            0% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.05); opacity: 0.7; }
            100% { transform: scale(1); opacity: 0.5; }
        }
      `}</style>

      {gameState === 'MENU' && (
        <div className="z-10 text-center flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-500">
          <h1 className="text-9xl font-black text-red-600 tracking-[0.2em] uppercase drop-shadow-[0_0_25px_rgba(255,0,0,0.9)]" 
              style={{fontFamily: 'Courier New', textShadow: '4px 4px 0px #300'}}>
            HELLSCAPE
          </h1>
          
          <div className="flex flex-col gap-4 w-64">
              <button 
                onClick={startGame}
                className="px-8 py-4 bg-gradient-to-r from-red-900 to-red-700 hover:from-red-600 hover:to-red-500 text-white font-bold text-xl rounded border-2 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all hover:scale-110 uppercase tracking-widest"
              >
                Start Game
              </button>
              <button 
                onClick={() => setGameState('SETTINGS')}
                className="px-8 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-lg rounded border border-neutral-700 transition-all hover:text-white uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Settings size={20}/> Settings
              </button>
          </div>
          
          <div className="grid grid-cols-2 gap-8 text-xs bg-black/60 backdrop-blur p-4 rounded-xl border border-red-900/50 mt-8">
             <div className="space-y-1 text-left">
                 <h3 className="text-green-500 font-bold border-b border-green-900 pb-1 mb-1">PLAYER 1</h3>
                 <div className="flex justify-between gap-4"><span>MOVE</span> <span className="text-white font-bold">WASD</span></div>
                 <div className="flex justify-between gap-4"><span>FIRE</span> <span className="text-white font-bold">SPACE</span></div>
             </div>
             <div className="space-y-1 text-left">
                 <h3 className="text-blue-500 font-bold border-b border-blue-900 pb-1 mb-1">PLAYER 2</h3>
                 <div className="flex justify-between gap-4"><span>MOVE</span> <span className="text-white font-bold">ARROWS</span></div>
                 <div className="flex justify-between gap-4"><span>FIRE</span> <span className="text-white font-bold">-</span></div>
             </div>
             <div className="col-span-2 text-center text-yellow-400 font-bold mt-2 pt-2 border-t border-red-900/50">
                 STRONGER TOGETHER: Stay close to regen shield. Press 'V' to revive partner.
             </div>
          </div>
        </div>
      )}

      {gameState === 'SETTINGS' && (
         <div className="z-10 w-[800px] bg-black/90 backdrop-blur-md p-8 rounded-2xl border border-red-900 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4">
             <div className="flex items-center justify-between border-b border-red-900/50 pb-4">
                <h2 className="text-3xl font-bold text-red-500 uppercase tracking-widest flex items-center gap-3">
                    <Keyboard className="w-8 h-8" /> 
                    Keybind Configuration
                </h2>
                <Settings className="text-red-500 animate-spin-slow" />
             </div>
             
             <div className="grid grid-cols-2 gap-12">
                 {/* Player 1 Column */}
                 <div className="space-y-4">
                     <h3 className="text-green-500 font-bold text-xl border-b border-green-900 pb-2 mb-4">PLAYER 1 (MARINE)</h3>
                     
                     <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded">
                         <span className="text-neutral-400">MOVEMENT</span>
                         <div className="flex gap-1">
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold">W</span>
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold">A</span>
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold">S</span>
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold">D</span>
                         </div>
                     </div>

                     <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded">
                         <span className="text-neutral-400">FIRE</span>
                         <span className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 font-mono font-bold text-sm">SPACE</span>
                     </div>

                     <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded">
                         <span className="text-neutral-400">SWITCH WEAPON</span>
                         <span className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 font-mono font-bold">Z</span>
                     </div>
                 </div>

                 {/* Player 2 Column */}
                 <div className="space-y-4">
                     <h3 className="text-blue-500 font-bold text-xl border-b border-blue-900 pb-2 mb-4">PLAYER 2 (CYBORG)</h3>
                     
                     <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded">
                         <span className="text-neutral-400">MOVEMENT</span>
                         <div className="flex gap-1">
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold text-xs flex items-center">▲</span>
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold text-xs flex items-center">◀</span>
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold text-xs flex items-center">▼</span>
                             <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-mono font-bold text-xs flex items-center">▶</span>
                         </div>
                     </div>

                     <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded">
                         <span className="text-neutral-400">FIRE</span>
                         <span className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 font-mono font-bold">-</span>
                     </div>

                     <div className="flex justify-between items-center bg-neutral-900/50 p-3 rounded">
                         <span className="text-neutral-400">SWITCH WEAPON</span>
                         <span className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 font-mono font-bold">+</span>
                     </div>
                 </div>
             </div>

             <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded text-center">
                 <h4 className="text-yellow-500 font-bold mb-2 flex items-center justify-center gap-2"><HeartHandshake size={16}/> SHARED ACTIONS</h4>
                 <div className="flex justify-center items-center gap-4">
                     <span className="text-neutral-300">REVIVE PARTNER</span>
                     <span className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 font-mono font-bold text-yellow-500">V</span>
                 </div>
             </div>

             <div className="pt-4 border-t border-neutral-800">
                 <button 
                    onClick={() => setGameState('MENU')}
                    className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-bold flex items-center justify-center gap-2 transition-colors"
                 >
                    <ArrowLeft size={18} /> Back to Menu
                 </button>
             </div>
         </div>
      )}

      {gameState === 'VICTORY' && (
        <div className="text-center z-10 space-y-6">
           <h1 className="text-8xl font-black text-yellow-500 drop-shadow-[0_0_30px_rgba(255,200,0,0.6)] animate-bounce">VICTORY</h1>
           <p className="text-2xl tracking-widest text-neutral-300">HELL HAS BEEN CLEANSED</p>
           <button onClick={() => setGameState('MENU')} className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded uppercase">Return to Base</button>
        </div>
      )}
      
      {gameState === 'GAMEOVER' && (
        <div className="text-center z-10 space-y-6 bg-black/90 p-12 rounded-xl border-2 border-red-600 shadow-[0_0_50px_rgba(255,0,0,0.4)]">
           <h1 className="text-8xl font-black text-red-600 mb-4 tracking-tighter">YOU DIED</h1>
           <p className="text-neutral-400 text-xl">THE DEMONS FEAST UPON YOUR SOUL</p>
           <button onClick={startGame} className="px-8 py-4 bg-red-800 hover:bg-red-700 rounded text-white font-bold uppercase text-xl shadow-lg transition-transform hover:scale-105">Respawn</button>
           <div className="mt-4">
            <button onClick={() => setGameState('MENU')} className="text-neutral-500 hover:text-white underline">Main Menu</button>
           </div>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="flex flex-col w-full h-full max-w-6xl max-h-screen p-2 gap-2 z-10">
            
          {/* Player 1 View */}
          <div className={`relative flex-1 border-4 ${hudState.p1.isKnocked ? 'border-red-600' : 'border-neutral-800'} bg-black rounded-lg overflow-hidden group shadow-lg transition-colors duration-300`}>
            <canvas ref={canvas1Ref} width={VIEW_WIDTH} height={VIEW_HEIGHT} className="w-full h-full object-fill pixelated" style={{imageRendering: 'pixelated'}} />
            
            {/* HUD P1 */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-2">
               <div className="flex gap-6 text-xl font-black text-green-500 drop-shadow-md bg-black/60 p-2 rounded-lg backdrop-blur-sm border border-green-900/30">
                  <span className={`flex items-center gap-2 ${hudState.p1.health < 30 ? 'text-red-500 animate-pulse' : ''}`}><Activity /> {hudState.p1.health}%</span>
                  <span className="flex items-center gap-2 text-cyan-400"><Shield /> {hudState.p1.shield}%</span>
                  <span className="flex items-center gap-2"><Zap /> {hudState.p1.ammo}</span>
                  <span className="flex items-center gap-2"><Crosshair /> {hudState.p1.weapon}</span>
               </div>
               {/* Powerups */}
               <div className="flex gap-2">
                   {isTogether && !hudState.p1.isKnocked && !hudState.p2.isKnocked && (
                       <span className="text-yellow-400 font-bold text-sm bg-black/50 px-2 rounded border border-yellow-500 flex items-center gap-1 animate-pulse"><HeartHandshake size={14}/> LINKED</span>
                   )}
                   {hudState.p1.powerups.QUAD_DAMAGE && hudState.p1.powerups.QUAD_DAMAGE > 0 && (
                       <span className="text-purple-500 font-bold text-sm bg-black/50 px-2 rounded border border-purple-500 flex items-center gap-1"><ZapOff size={14}/> QUAD {(hudState.p1.powerups.QUAD_DAMAGE/1000).toFixed(1)}s</span>
                   )}
                   {hudState.p1.powerups.INVULNERABILITY && hudState.p1.powerups.INVULNERABILITY > 0 && (
                       <span className="text-cyan-500 font-bold text-sm bg-black/50 px-2 rounded border border-cyan-500 flex items-center gap-1"><Shield size={14}/> INVULNERABLE {(hudState.p1.powerups.INVULNERABILITY/1000).toFixed(1)}s</span>
                   )}
               </div>
            </div>
            
            {/* Minimap P1 */}
            <div className="absolute top-4 left-4 border-2 border-green-900 bg-black/80 rounded overflow-hidden opacity-80">
                <canvas ref={minimap1Ref} width={128} height={128} className="block" />
            </div>

            <div className="absolute top-4 right-4 text-green-500 font-bold bg-black/40 px-3 py-1 rounded">P1</div>
          </div>

          {/* Player 2 View */}
          <div className={`relative flex-1 border-4 ${hudState.p2.isKnocked ? 'border-red-600' : 'border-neutral-800'} bg-black rounded-lg overflow-hidden group shadow-lg transition-colors duration-300`}>
            <canvas ref={canvas2Ref} width={VIEW_WIDTH} height={VIEW_HEIGHT} className="w-full h-full object-fill pixelated" style={{imageRendering: 'pixelated'}} />
            
             {/* HUD P2 */}
             <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                <div className="flex gap-6 text-xl font-black text-blue-500 drop-shadow-md bg-black/60 p-2 rounded-lg backdrop-blur-sm border border-blue-900/30">
                  <span className={`flex items-center gap-2 ${hudState.p2.health < 30 ? 'text-red-500 animate-pulse' : ''}`}><Activity /> {hudState.p2.health}%</span>
                  <span className="flex items-center gap-2 text-cyan-400"><Shield /> {hudState.p2.shield}%</span>
                  <span className="flex items-center gap-2"><Zap /> {hudState.p2.ammo}</span>
                  <span className="flex items-center gap-2"><Crosshair /> {hudState.p2.weapon}</span>
                </div>
                {/* Powerups */}
                <div className="flex gap-2">
                   {isTogether && !hudState.p1.isKnocked && !hudState.p2.isKnocked && (
                       <span className="text-yellow-400 font-bold text-sm bg-black/50 px-2 rounded border border-yellow-500 flex items-center gap-1 animate-pulse"><HeartHandshake size={14}/> LINKED</span>
                   )}
                   {hudState.p2.powerups.QUAD_DAMAGE && hudState.p2.powerups.QUAD_DAMAGE > 0 && (
                       <span className="text-purple-500 font-bold text-sm bg-black/50 px-2 rounded border border-purple-500 flex items-center gap-1"><ZapOff size={14}/> QUAD {(hudState.p2.powerups.QUAD_DAMAGE/1000).toFixed(1)}s</span>
                   )}
                   {hudState.p2.powerups.INVULNERABILITY && hudState.p2.powerups.INVULNERABILITY > 0 && (
                       <span className="text-cyan-500 font-bold text-sm bg-black/50 px-2 rounded border border-cyan-500 flex items-center gap-1"><Shield size={14}/> INVULNERABLE {(hudState.p2.powerups.INVULNERABILITY/1000).toFixed(1)}s</span>
                   )}
                </div>
            </div>
            
            {/* Minimap P2 */}
            <div className="absolute top-4 left-4 border-2 border-blue-900 bg-black/80 rounded overflow-hidden opacity-80">
                <canvas ref={minimap2Ref} width={128} height={128} className="block" />
            </div>

            <div className="absolute top-4 right-4 text-blue-500 font-bold bg-black/40 px-3 py-1 rounded">P2</div>
          </div>
          
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm bg-black/80 px-4 py-1 rounded-full border border-neutral-800 z-50">
              LEVEL {levelIndex + 1}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
