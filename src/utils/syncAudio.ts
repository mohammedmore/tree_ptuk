/**
 * Lightweight Synthesized Web Audio Effects for Wait Experience
 * Generates instant acoustic feedback for mini-games and quiz interactions
 * with zero external assets, instant responsiveness, and full mute controls.
 */

let audioCtx: AudioContext | null = null;
let isMutedState = false;

if (typeof window !== "undefined") {
  try {
    isMutedState =
      window.localStorage.getItem("ptuk_sync_audio_muted") === "true";
  } catch {
    isMutedState = false;
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isAudioMuted(): boolean {
  return isMutedState;
}

export function setAudioMuted(muted: boolean): void {
  isMutedState = muted;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("ptuk_sync_audio_muted", String(muted));
    } catch {}
  }
}

export function toggleAudioMuted(): boolean {
  setAudioMuted(!isMutedState);
  return isMutedState;
}

export function playSyncSound(
  type: "jump" | "collect" | "obstacle" | "correct" | "wrong" | "complete",
): void {
  if (isMutedState) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case "jump": {
        // Upward frequency chirp
        osc.type = "sine";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case "collect": {
        // High sparkling bell chime
        osc.type = "triangle";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.06); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
      case "obstacle": {
        // Low soft thud
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
      case "correct": {
        // Cheerful major third chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
      case "wrong": {
        // Low dissonance
        osc.type = "square";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(196, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case "complete": {
        // Triumphant rising arpeggio
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(554.37, now + 0.08); // C#5
        osc.frequency.setValueAtTime(659.25, now + 0.16); // E5
        osc.frequency.setValueAtTime(880, now + 0.24); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
        break;
      }
    }
  } catch {
    // Ignore audio failures on background or restricted tabs
  }
}
