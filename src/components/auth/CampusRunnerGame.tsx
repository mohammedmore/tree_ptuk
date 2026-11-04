import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  playSyncSound,
  isAudioMuted,
  toggleAudioMuted,
} from "../../utils/syncAudio";
import { triggerHaptic } from "../../utils/haptics";
import {
  Trophy,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface CampusRunnerGameProps {
  isSuccess?: boolean;
  onProceedToPlanner?: () => void;
  onUserPlayed?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface Item {
  x: number;
  y: number;
  type: "star" | "gem" | "trophy";
  points: number;
  width: number;
  height: number;
  collected: boolean;
}

interface Obstacle {
  x: number;
  y: number;
  type: "barrier" | "cone" | "rock";
  width: number;
  height: number;
}

const HIGH_SCORE_KEY = "ptuk_runner_high_score";
const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 200;
const GROUND_Y = 168; // Floor line near bottom edge

export const CampusRunnerGame: React.FC<CampusRunnerGameProps> = ({
  isSuccess = false,
  onProceedToPlanner,
  onUserPlayed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return (
        parseInt(window.localStorage.getItem(HIGH_SCORE_KEY) || "0", 10) || 0
      );
    } catch {
      return 0;
    }
  });
  const [gameOver, setGameOver] = useState(false);
  const [muted, setMuted] = useState(() => isAudioMuted());
  const [streakCount, setStreakCount] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null,
  );

  // Mutable game state held in refs for 60fps loop
  const gameStateRef = useRef({
    playerY: GROUND_Y - 40,
    playerVy: 0,
    isJumping: false,
    jumpCount: 0,
    legPhase: 0,
    distance: 0,
    speed: 4.2,
    items: [] as Item[],
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    nextObstacleDist: 120,
    nextItemDist: 60,
    isDead: false,
    currentScore: 0,
  });

  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const interactionCountRef = useRef(0);

  const jump = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return;
    interactionCountRef.current++;
    if (interactionCountRef.current >= 2) {
      onUserPlayed?.();
    }
    const s = gameStateRef.current;
    if (s.isDead) return;

    // Max 2 jumps (double jump)
    if (s.jumpCount < 2) {
      s.playerVy = s.jumpCount === 0 ? -8.4 : -7.6;
      s.jumpCount++;
      s.isJumping = true;
      playSyncSound("jump");
      triggerHaptic("light");

      // Jump puff dust particles
      for (let i = 0; i < 5; i++) {
        s.particles.push({
          x: 68,
          y: s.playerY + 36,
          vx: (Math.random() - 0.5) * 3 - 2,
          vy: Math.random() * 2,
          color: "rgba(169, 195, 139, 0.7)",
          size: Math.random() * 4 + 2,
          life: 0,
          maxLife: 16,
        });
      }
    }
  }, []);

  const restartGame = useCallback(() => {
    onUserPlayed?.();
    setRedirectCountdown(null);
    const s = gameStateRef.current;
    s.playerY = GROUND_Y - 40;
    s.playerVy = 0;
    s.isJumping = false;
    s.jumpCount = 0;
    s.legPhase = 0;
    s.distance = 0;
    s.speed = 4.2;
    s.items = [];
    s.obstacles = [];
    s.particles = [];
    s.floatingTexts = [];
    s.nextObstacleDist = 120;
    s.nextItemDist = 50;
    s.isDead = false;
    s.currentScore = 0;

    setScore(0);
    setGameOver(false);
    setStreakCount(0);
    lastTimeRef.current = null;
  }, []);

  const handleToggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = toggleAudioMuted();
    setMuted(next);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (typeof window !== "undefined" && window.innerWidth < 768) return;
      if (
        e.code === "Space" ||
        e.code === "ArrowUp" ||
        e.key === "w" ||
        e.key === "W"
      ) {
        e.preventDefault();
        if (gameStateRef.current.isDead) {
          restartGame();
        } else {
          jump();
        }
      } else if (e.code === "Enter" && isSuccess && onProceedToPlanner) {
        e.preventDefault();
        onProceedToPlanner();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jump, restartGame, isSuccess, onProceedToPlanner]);

  // Main 60fps Game Loop
  useEffect(() => {
    // Safety guard: Never run loop or sounds on mobile viewports (< 768px)
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const gameLoop = (timestamp: number) => {
      if (!isRunning) return;
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        isRunning = false;
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        animFrameIdRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.08);
      lastTimeRef.current = timestamp;

      const s = gameStateRef.current;

      // ─── 1. Update Game State (DO NOT STOP on isSuccess; keep playing uninterrupted!) ──
      if (!s.isDead) {
        s.distance += s.speed;
        s.legPhase += dt * 15;

        // Player physics
        s.playerVy += 22 * dt; // gravity
        s.playerY += s.playerVy * 60 * dt;

        if (s.playerY >= GROUND_Y - 40) {
          s.playerY = GROUND_Y - 40;
          s.playerVy = 0;
          s.isJumping = false;
          s.jumpCount = 0;
        }

        // Spawn obstacles
        // Spawn obstacles (Solid road/construction barriers on the ground)
        s.nextObstacleDist -= s.speed;
        if (s.nextObstacleDist <= 0) {
          const types: Obstacle["type"][] = ["barrier", "cone", "rock"];
          const selectedType = types[Math.floor(Math.random() * types.length)];
          const width =
            selectedType === "barrier" ? 28 : selectedType === "cone" ? 18 : 24;
          const height =
            selectedType === "barrier" ? 26 : selectedType === "cone" ? 24 : 20;
          s.obstacles.push({
            x: VIRTUAL_WIDTH + 20,
            y: GROUND_Y - height,
            type: selectedType,
            width,
            height,
          });
          s.nextObstacleDist = Math.random() * 160 + 170;
        }

        // Spawn collectible items (All floating high in the air, requiring jumps)
        s.nextItemDist -= s.speed;
        if (s.nextItemDist <= 0) {
          const itemRand = Math.random();
          const itemType: Item["type"] =
            itemRand > 0.6 ? "star" : itemRand > 0.3 ? "gem" : "trophy";
          const points =
            itemType === "star" ? 100 : itemType === "gem" ? 50 : 30;
          const itemY = Math.random() > 0.5 ? GROUND_Y - 76 : GROUND_Y - 52;

          s.items.push({
            x: VIRTUAL_WIDTH + 20,
            y: itemY,
            type: itemType,
            points,
            width: 22,
            height: 22,
            collected: false,
          });
          s.nextItemDist = Math.random() * 100 + 90;
        }

        // Update items and check collection
        for (let i = s.items.length - 1; i >= 0; i--) {
          const item = s.items[i];
          item.x -= s.speed;

          // Player hitbox (px=62, py=s.playerY, pw=26, ph=38)
          const px = 62;
          const py = s.playerY;
          const pw = 26;
          const ph = 38;

          if (
            !item.collected &&
            px < item.x + item.width &&
            px + pw > item.x &&
            py < item.y + item.height &&
            py + ph > item.y
          ) {
            item.collected = true;
            s.currentScore += item.points;
            setScore(s.currentScore);
            setStreakCount((prev) => prev + 1);

            // Update high score
            if (s.currentScore > highScore) {
              setHighScore(s.currentScore);
              try {
                window.localStorage.setItem(
                  HIGH_SCORE_KEY,
                  String(s.currentScore),
                );
              } catch {}
            }

            playSyncSound("collect");
            triggerHaptic("selection");

            // Floating text
            s.floatingTexts.push({
              x: item.x,
              y: item.y - 12,
              text: `+${item.points}`,
              color:
                item.type === "star"
                  ? "#F59E0B"
                  : item.type === "gem"
                    ? "#10B981"
                    : "#EAB308",
              life: 0,
              maxLife: 26,
            });

            // Sparkle particles
            for (let p = 0; p < 8; p++) {
              s.particles.push({
                x: item.x + 11,
                y: item.y + 11,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color:
                  item.type === "star"
                    ? "#FBBF24"
                    : item.type === "gem"
                      ? "#34D399"
                      : "#FACC15",
                size: Math.random() * 3.5 + 2,
                life: 0,
                maxLife: 20,
              });
            }
          }

          if (item.x < -30 || item.collected) {
            s.items.splice(i, 1);
          }
        }

        // Update obstacles and check collisions
        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const obs = s.obstacles[i];
          obs.x -= s.speed;

          const px = 64;
          const py = s.playerY + 4;
          const pw = 22;
          const ph = 34;

          if (
            px < obs.x + obs.width - 3 &&
            px + pw > obs.x + 3 &&
            py < obs.y + obs.height &&
            py + ph > obs.y + 4
          ) {
            // Hit obstacle
            s.isDead = true;
            setGameOver(true);
            playSyncSound("obstacle");
            triggerHaptic("warning");

            // Explosion particles
            for (let p = 0; p < 16; p++) {
              s.particles.push({
                x: px + 12,
                y: py + 16,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                color: "#EF4444",
                size: Math.random() * 4 + 2,
                life: 0,
                maxLife: 26,
              });
            }
            break;
          }

          if (obs.x < -30) {
            s.obstacles.splice(i, 1);
          }
        }

        // Gradual speed progression
        if (s.speed < 6.5) {
          s.speed += dt * 0.05;
        }
      }

      // Update particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life >= p.maxLife) {
          s.particles.splice(i, 1);
        }
      }

      // Update floating texts
      for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
        const ft = s.floatingTexts[i];
        ft.y -= 0.8;
        ft.life++;
        if (ft.life >= ft.maxLife) {
          s.floatingTexts.splice(i, 1);
        }
      }

      // ─── 2. Render Canvas ──────────────────────────────────
      ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

      // Sky Background gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, "rgba(22, 28, 24, 0.4)");
      skyGrad.addColorStop(1, "rgba(35, 45, 36, 0.1)");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, GROUND_Y);

      // Distant rolling Tulkarm hills
      const hillOffset = (s.distance * 0.12) % 400;
      ctx.fillStyle = "rgba(75, 95, 70, 0.15)";
      ctx.beginPath();
      ctx.moveTo(-hillOffset, GROUND_Y);
      for (let h = -hillOffset; h < VIRTUAL_WIDTH + 400; h += 200) {
        ctx.quadraticCurveTo(h + 100, GROUND_Y - 45, h + 200, GROUND_Y);
      }
      ctx.lineTo(VIRTUAL_WIDTH, GROUND_Y);
      ctx.fill();

      // Distant Khadoorie Campus Architecture & Historic Clocktower
      const bgOffset = (s.distance * 0.3) % 400;
      ctx.fillStyle = "rgba(110, 130, 105, 0.2)";
      for (let arch = -1; arch < 3; arch++) {
        const archX = arch * 280 - bgOffset;
        // Historic Khadoorie clocktower
        ctx.fillRect(archX + 30, GROUND_Y - 60, 32, 60);
        ctx.beginPath();
        ctx.moveTo(archX + 26, GROUND_Y - 60);
        ctx.lineTo(archX + 46, GROUND_Y - 85);
        ctx.lineTo(archX + 66, GROUND_Y - 60);
        ctx.fill();
        // Clock circle
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(archX + 46, GROUND_Y - 50, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(110, 130, 105, 0.2)";

        // Campus Faculty Arches & Wings
        ctx.fillRect(archX + 80, GROUND_Y - 42, 65, 42);
        ctx.fillRect(archX + 160, GROUND_Y - 35, 45, 35);

        // Khadoorie Olive Tree Silhouettes
        ctx.fillStyle = "rgba(60, 80, 55, 0.25)";
        ctx.beginPath();
        ctx.arc(archX + 225, GROUND_Y - 26, 14, 0, Math.PI * 2);
        ctx.arc(archX + 235, GROUND_Y - 32, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(archX + 228, GROUND_Y - 14, 4, 14); // Trunk
        ctx.fillStyle = "rgba(110, 130, 105, 0.2)";
      }

      // Moving campus clouds
      const cloudOffset = (s.distance * 0.15) % 600;
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (let c = 0; c < 4; c++) {
        const cx = (c * 200 - cloudOffset + 800) % 800;
        ctx.beginPath();
        ctx.arc(cx, 35, 16, 0, Math.PI * 2);
        ctx.arc(cx + 15, 30, 20, 0, Math.PI * 2);
        ctx.arc(cx + 32, 35, 15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ground Line & Campus Pavers directly at bottom
      ctx.fillStyle = "rgba(16, 185, 129, 0.8)"; // University green grass strip
      ctx.fillRect(0, GROUND_Y, VIRTUAL_WIDTH, 4);

      // Floor stone pavement texture scrolling right down to bottom edge
      ctx.fillStyle = "rgba(30, 41, 35, 0.95)";
      ctx.fillRect(
        0,
        GROUND_Y + 4,
        VIRTUAL_WIDTH,
        VIRTUAL_HEIGHT - (GROUND_Y + 4),
      );

      const stoneOffset = s.distance % 32;
      ctx.fillStyle = "rgba(130, 150, 120, 0.2)";
      for (let x = -stoneOffset; x < VIRTUAL_WIDTH; x += 32) {
        ctx.fillRect(x, GROUND_Y + 7, 26, 6);
        ctx.fillRect(x + 14, GROUND_Y + 17, 26, 7);
      }

      // Render Obstacles (Distinct Grounded Street Barriers & Hazards - 100% physically intuitive)
      for (const obs of s.obstacles) {
        if (obs.type === "barrier") {
          // Heavy construction road barrier with red & white warning chevrons
          // Metal uprights
          ctx.fillStyle = "#64748B";
          ctx.fillRect(obs.x + 3, obs.y + 8, 3, obs.height - 8);
          ctx.fillRect(obs.x + obs.width - 6, obs.y + 8, 3, obs.height - 8);
          // Heavy rubber base feet on the asphalt
          ctx.fillStyle = "#0F172A";
          ctx.fillRect(obs.x, obs.y + obs.height - 3, 8, 3);
          ctx.fillRect(obs.x + obs.width - 8, obs.y + obs.height - 3, 8, 3);
          // Hazard crossbar
          ctx.fillStyle = "#DC2626"; // Vibrant barrier red
          ctx.fillRect(obs.x, obs.y + 4, obs.width, 10);
          // White diagonal hazard stripes
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(obs.x + 4, obs.y + 14);
          ctx.lineTo(obs.x + 9, obs.y + 4);
          ctx.lineTo(obs.x + 13, obs.y + 4);
          ctx.lineTo(obs.x + 8, obs.y + 14);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(obs.x + 15, obs.y + 14);
          ctx.lineTo(obs.x + 20, obs.y + 4);
          ctx.lineTo(obs.x + 24, obs.y + 4);
          ctx.lineTo(obs.x + 19, obs.y + 14);
          ctx.closePath();
          ctx.fill();
          // Flashing beacon light on top
          ctx.fillStyle = "#F59E0B";
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y + 3, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === "cone") {
          // Highway safety traffic cone (bright neon orange)
          const cx = obs.x + obs.width / 2;
          // Black weighted base
          ctx.fillStyle = "#0F172A";
          ctx.fillRect(obs.x, obs.y + obs.height - 3, obs.width, 3);
          // Neon orange cone body
          ctx.fillStyle = "#EA580C";
          ctx.beginPath();
          ctx.moveTo(cx, obs.y + 1);
          ctx.lineTo(obs.x + obs.width - 2, obs.y + obs.height - 3);
          ctx.lineTo(obs.x + 2, obs.y + obs.height - 3);
          ctx.closePath();
          ctx.fill();
          // Reflective white safety collar band
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(cx - 3, obs.y + 8);
          ctx.lineTo(cx + 3, obs.y + 8);
          ctx.lineTo(cx + 5, obs.y + 14);
          ctx.lineTo(cx - 5, obs.y + 14);
          ctx.closePath();
          ctx.fill();
        } else {
          // Solid rugged stone boulder
          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.moveTo(obs.x + 2, obs.y + obs.height);
          ctx.lineTo(obs.x + 5, obs.y + 7);
          ctx.lineTo(obs.x + 13, obs.y + 2);
          ctx.lineTo(obs.x + obs.width - 3, obs.y + 8);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.closePath();
          ctx.fill();
          // Rock highlight facets
          ctx.fillStyle = "#94A3B8";
          ctx.beginPath();
          ctx.moveTo(obs.x + 5, obs.y + 7);
          ctx.lineTo(obs.x + 13, obs.y + 2);
          ctx.lineTo(obs.x + 15, obs.y + 11);
          ctx.lineTo(obs.x + 8, obs.y + 12);
          ctx.closePath();
          ctx.fill();
          // Rock shadow facets
          ctx.fillStyle = "#1E293B";
          ctx.beginPath();
          ctx.moveTo(obs.x + 13, obs.y + 2);
          ctx.lineTo(obs.x + obs.width - 3, obs.y + 8);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.lineTo(obs.x + 15, obs.y + 11);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Render Collectible Items (All Glowing, Sparkling Treasures Floating in Mid-Air)
      for (const item of s.items) {
        if (item.type === "star") {
          // Golden A+ Spinning Star
          ctx.save();
          ctx.translate(item.x + 11, item.y + 11);
          const starRotate = (s.distance * 0.08) % (Math.PI * 2);
          ctx.rotate(starRotate);
          ctx.fillStyle = "#F59E0B";
          ctx.beginPath();
          for (let p = 0; p < 5; p++) {
            ctx.lineTo(
              Math.cos(((18 + p * 72) * Math.PI) / 180) * 11,
              -Math.sin(((18 + p * 72) * Math.PI) / 180) * 11,
            );
            ctx.lineTo(
              Math.cos(((54 + p * 72) * Math.PI) / 180) * 5,
              -Math.sin(((54 + p * 72) * Math.PI) / 180) * 5,
            );
          }
          ctx.closePath();
          ctx.fill();
          // Glowing center core
          ctx.fillStyle = "#FEF08A";
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (item.type === "gem") {
          // Sparkling Emerald Green Diamond Gem
          const cx = item.x + 11;
          const cy = item.y + 11;
          // Emerald diamond
          ctx.fillStyle = "#10B981";
          ctx.beginPath();
          ctx.moveTo(cx, cy - 10);
          ctx.lineTo(cx + 9, cy);
          ctx.lineTo(cx, cy + 10);
          ctx.lineTo(cx - 9, cy);
          ctx.closePath();
          ctx.fill();
          // Bright facet highlight
          ctx.fillStyle = "#6EE7B7";
          ctx.beginPath();
          ctx.moveTo(cx, cy - 10);
          ctx.lineTo(cx + 9, cy);
          ctx.lineTo(cx, cy);
          ctx.closePath();
          ctx.fill();
          // Darker facet shadow
          ctx.fillStyle = "#047857";
          ctx.beginPath();
          ctx.moveTo(cx, cy + 10);
          ctx.lineTo(cx - 9, cy);
          ctx.lineTo(cx, cy);
          ctx.closePath();
          ctx.fill();
          // Shimmer gleam
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(cx - 2, cy - 3, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Golden Winner Trophy Cup
          const cx = item.x + 11;
          const cy = item.y + 11;
          // Cup base
          ctx.fillStyle = "#78350F";
          ctx.fillRect(cx - 5, cy + 6, 10, 3);
          // Cup stem
          ctx.fillStyle = "#D97706";
          ctx.fillRect(cx - 2, cy + 2, 4, 4);
          // Cup bowl
          ctx.fillStyle = "#EAB308";
          ctx.beginPath();
          ctx.moveTo(cx - 7, cy - 7);
          ctx.lineTo(cx + 7, cy - 7);
          ctx.lineTo(cx + 5, cy + 2);
          ctx.lineTo(cx - 5, cy + 2);
          ctx.closePath();
          ctx.fill();
          // Handles
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx - 7, cy - 2, 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx + 7, cy - 2, 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Render Player (PTUK Student Character)
      const px = 62;
      const py = s.playerY;

      // Graduation gown (body)
      ctx.fillStyle = "#0F172A";
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 14);
      ctx.lineTo(px + 22, py + 14);
      ctx.lineTo(px + 26, py + 34);
      ctx.lineTo(px, py + 34);
      ctx.closePath();
      ctx.fill();

      // University Green Sash / Scarf
      ctx.fillStyle = "#10B981";
      ctx.fillRect(px + 10, py + 14, 6, 16);

      // Student Head
      ctx.fillStyle = "#FDBA74"; // Skin tone
      ctx.beginPath();
      ctx.arc(px + 13, py + 8, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Mortarboard Cap (Graduation Hat)
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.moveTo(px + 13, py - 2);
      ctx.lineTo(px + 26, py + 2);
      ctx.lineTo(px + 13, py + 6);
      ctx.lineTo(px, py + 2);
      ctx.closePath();
      ctx.fill();

      // Cap base
      ctx.fillRect(px + 8, py + 4, 10, 4);

      // Gold tassel flying in the wind
      const tasselSway = Math.sin(s.legPhase) * 4;
      ctx.strokeStyle = "#FBBF24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 13, py + 2);
      ctx.quadraticCurveTo(
        px + 22 + tasselSway,
        py + 3,
        px + 25 + tasselSway,
        py + 11,
      );
      ctx.stroke();

      // Running Legs (animated using sine of legPhase)
      ctx.strokeStyle = "#020617";
      ctx.lineWidth = 3;
      const leg1Angle = s.isJumping ? 0.45 : Math.sin(s.legPhase) * 0.75;
      const leg2Angle = s.isJumping ? -0.45 : -Math.sin(s.legPhase) * 0.75;

      // Left leg
      ctx.beginPath();
      ctx.moveTo(px + 8, py + 34);
      ctx.lineTo(
        px + 8 + Math.sin(leg1Angle) * 9,
        py + 34 + Math.cos(leg1Angle) * 9,
      );
      ctx.stroke();

      // Right leg
      ctx.beginPath();
      ctx.moveTo(px + 18, py + 34);
      ctx.lineTo(
        px + 18 + Math.sin(leg2Angle) * 9,
        py + 34 + Math.cos(leg2Angle) * 9,
      );
      ctx.stroke();

      // Render Particles
      for (const p of s.particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Floating Text
      for (const ft of s.floatingTexts) {
        ctx.fillStyle = ft.color;
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
      }

      animFrameIdRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [highScore]);

  // Auto-redirect countdown when game is over and sync is complete
  useEffect(() => {
    if (!isSuccess || !gameOver || !onProceedToPlanner) {
      setRedirectCountdown(null);
      return;
    }

    if (redirectCountdown === null) {
      setRedirectCountdown(3);
      return;
    }

    if (redirectCountdown <= 0) {
      onProceedToPlanner();
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((prev) =>
        prev !== null && prev > 0 ? prev - 1 : 0,
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [isSuccess, gameOver, redirectCountdown, onProceedToPlanner]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-t-2xl border-t-2 border-x border-emerald-500/40 bg-slate-950 overflow-hidden shadow-2xl select-none flex-1 max-h-[calc(100vh-180px)] min-h-[160px] flex flex-col justify-end"
      onClick={gameOver ? restartGame : jump}
      role="region"
      aria-label="لعبة ركض الطالب على أرضية المتصفح"
    >
      {/* Top HUD with Score, Streak, High Score, Mute, and Controls Hint */}
      <div className="absolute top-2 inset-x-3 sm:inset-x-5 flex items-center justify-between text-xs z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 text-amber-300 font-bold border border-amber-400/40 shadow-xs">
            <Sparkles size={13} className="text-amber-400" />
            <span>النقاط: {score}</span>
          </div>
          {streakCount >= 3 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/90 text-emerald-400 font-bold border border-emerald-500/50 text-[10px] sm:text-[11px] animate-pulse">
              <Zap size={11} />
              <span>سلسلة تفوق!</span>
            </span>
          )}
          <span className="hidden sm:inline-block text-[11px] text-slate-300 font-medium px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700">
            Space أو انقر للقفز 🚀
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/90 text-slate-300 text-[10px] sm:text-[11px] border border-slate-700">
            <Trophy size={12} className="text-amber-400" />
            <span>أعلى سكور: {highScore}</span>
          </div>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
            className="p-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-colors"
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      </div>

      {/* Main Canvas - Stretched & Positioned at floor */}
      <canvas
        ref={canvasRef}
        width={VIRTUAL_WIDTH}
        height={VIRTUAL_HEIGHT}
        className="w-full h-full max-h-[220px] sm:max-h-[250px] block cursor-pointer"
      />

      {/* Game Over Banner - Allows continuing OR proceeding to planner if sync is done! */}
      {gameOver && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center z-20 animate-fade-in">
          <p className="text-rose-400 font-bold text-sm sm:text-base mb-1">
            اصطدمت بعائق في الطريق! 🚧
          </p>
          <p className="text-xs sm:text-sm text-slate-300 mb-3">
            جمعت{" "}
            <span className="text-amber-400 font-bold text-base">{score}</span>{" "}
            نقطة خلال الجولة
          </p>

          <div className="flex items-center gap-2.5">
            {isSuccess && onProceedToPlanner ? (
              <div className="flex flex-col items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full shadow-sm animate-pulse">
                  <Clock size={12} className="text-emerald-400" />
                  <span>
                    جاري نقلك للمخطط تلقائياً خلال {redirectCountdown ?? 3}{" "}
                    ثوانٍ...
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProceedToPlanner();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-emerald-950/70 cursor-pointer transition-transform active:scale-95 border border-emerald-300 animate-pulse"
                  >
                    <span>الانتقال للمخطط الآن 🚀</span>
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      restartGame();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-600 cursor-pointer transition-transform active:scale-95"
                  >
                    <RotateCcw size={13} />
                    <span>جولة ثانية</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  restartGame();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
              >
                <RotateCcw size={14} />
                <span>العب مجدداً (المسافة للقفز)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusRunnerGame;
