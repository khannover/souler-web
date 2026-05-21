/**
 * Souler Web — app.js
 * ===================
 * Main application logic for the Souler AI Live Speaker experience.
 *
 * Sections:
 *  1. State Management
 *  2. Settings (load/save)
 *  3. Particle Background
 *  4. Character Renderer (Canvas)
 *  5. Web Audio API — Beat/Energy Detection
 *  6. Audio Player
 *  7. Environmental Microphone Listener
 *  8. Voice Commands (Web Speech Recognition)
 *  9. AI Chat (OpenAI-compatible API)
 * 10. UI Controls & Event Wiring
 * 11. Animation Loop
 * 12. Utility Helpers
 * 13. PWA & Initialization
 */

'use strict';

/* ─────────────────────────────────────────────────
   1. STATE MANAGEMENT
   ───────────────────────────────────────────────── */

const AppState = {
  mode: 'idle',           // 'idle' | 'dance' | 'music' | 'chat'
  characterImage: null,   // HTMLImageElement | HTMLVideoElement
  characterMediaType: 'image', // 'image' | 'video'
  characterObjectURL: null, // temporary object URL for uploaded local character media
  characterImageDataURL: null, // base64 data URL (PNG) for export/import & sharing
  audioContext: null,
  analyser: null,
  playerSource: null,     // MediaElementAudioSourceNode
  micSource: null,        // MediaStreamAudioSourceNode
  micStream: null,
  audioElement: new Audio(),
  lastAudioSource: null,   // 'file' | 'url'
  isPlaying: false,
  isMicListening: false,
  isVoiceListening: false,
  isSpeaking: false,      // TTS is currently playing (for mouth animation)
  micEnergy: 0,           // 0–1 current environmental mic level (for UI meter)
  micConfirmCount: 0,     // frames above threshold (for debounced music detection)
  beatEnergy: 0,          // 0–1 current audio energy (sustained)
  peakEnergy: 0,          // running peak for normalization
  beatThreshold: CONFIG.beat.defaultThreshold,
  prevFreqData: null,     // previous frame freq data for spectral flux
  onset: 0,               // 0–1 percussive onset strength (spectral flux)
  onsetPeak: 0,           // for normalizing onset over time
  envMusicDetected: false,
  animFrame: null,
  particles: [],
  vizBars: [],
  chatHistory: [],
  settings: {
    apiKey: '',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    volume: 0.8,
    sensitivity: 0.5,
    theme: 'neon',
    animSpeed: 1.0,
    systemPrompt: 'You are Souler, a fun and friendly AI music companion. Keep responses concise and upbeat. You love music, dancing, and making people smile. Max 2 sentences.',
  },

  // Character animation state
  anim: {
    // Shared
    scale: 1,
    targetScale: 1,
    rotation: 0,
    targetRotation: 0,
    x: 0,
    targetX: 0,
    y: 0,
    targetY: 0,
    // Idle breathing
    breathPhase: 0,
    blinkTimer: 0,
    blinkOpen: 1,
    // Dance bouncing
    bouncePhase: 0,
    swayPhase: 0,
    // Flash effect
    flashAlpha: 0,
    flashColor: '#00f5ff',
    // Shake
    shakeX: 0,
    shakeY: 0,
    // TTS speaking animation
    speakingPhase: 0,
  },
};

/* ─────────────────────────────────────────────────
   CONFIG — All tunable constants in one place
   Makes animation, particles, audio, and thresholds easy to tweak.
   ───────────────────────────────────────────────── */
const CONFIG = {
  // Audio analysis
  audio: {
    fftSize: 256,
    playerSmoothing: 0.8,
    micSmoothing: 0.7,
    energyFocusRatio: 0.5,
    peakDecay: 0.995,
    minPeak: 0.01,
  },

  // Particle system
  particles: {
    initialCount: 60,
    maxCount: 150,
    baseSpeed: 0.3,
    lifeDecay: 0.003,
    connectionDistance: 80,
    burstMultiplier: 5,
    burstEnergyThreshold: 0.7,
    burstSpread: 200,
    burstVelocity: 2,
    burstRadius: [1, 3],
  },

  // Character canvas & rendering
  character: {
    maxCanvasSize: 420,
    maxUploadBytes: 25 * 1024 * 1024, // 25MB
    sizeLandscape: 0.85,
    sizePortrait: 0.75,
    shadowBase: 20,
    shadowEnergy: 40,
    flashThreshold: 0.01,
    flashAlphaMul: 0.3,
  },

  // Animation lerps and motion parameters
  animation: {
    lerp: {
      scale: 0.12,
      rotation: 0.1,
      position: 0.1,
      flash: 0.88,
    },
    idle: {
      breathSpeed: 0.8,
      breathAmount: 0.02,
      floatAmount: 3,
      blinkMin: 3.5,
      blinkRandom: 2,
    },
    dance: {
      bounceSpeed: 3,
      swaySpeed: 1.5,
      scaleAmount: 0.08,
      yAmount: 18,
      xAmount: 10,
      rotAmount: 3,
    },
    music: {
      bounceBase: 2,
      bounceEnergy: 4,
      swayBase: 1,
      swayEnergy: 2,
      beatScale: 0.15,
      beatY: 20,
      idleScale: 0.04,
      idleY: 8,
      xBase: 5,
      xEnergy: 10,
      rotBase: 2,
      rotEnergy: 4,
      shakeThreshold: 0.75,
      shakeAmount: 8,
    },
  },

  // Beat detection & visualizer
  beat: {
    defaultThreshold: 0.15,
    sensitivityHigh: 0.3,
    sensitivityLow: 0.05,
    envMicFactor: 0.5,
    envMicCap: 0.3,
    visualizerMaxH: 55,
    visualizerHueShift: 50,

    // Onset detection (spectral flux) — makes dancing feel much tighter on beats
    onsetDecay: 0.92,
    onsetNormDiv: 80,         // divisor for raw flux → 0-1 normalization
    onsetTrigger: 0.55,       // when onset exceeds this, treat as strong beat
  },

  // Glow rings around character
  glow: {
    outerBase: 0.45,
    innerBase: 0.65,
    outerEnergy: 0.15,
    innerEnergy: 0.1,
    sizeBase: 12,
    sizeEnergy: 30,
    alphaBase: 0.2,
    alphaEnergy: 0.5,
  },

  // UI, chat, AI, timing
  ui: {
    chatHistoryLimit: 30,
    aiPromptTurns: 10,
    aiMaxTokens: 120,
    toastDuration: 3000,
    voiceFeedbackDuration: 2500,
    resizeDebounce: 200,
    animationDeltaCap: 0.1,
  },
};

/* ─────────────────────────────────────────────────
   2. SETTINGS
   ───────────────────────────────────────────────── */

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('souler-settings') || '{}');
    Object.assign(AppState.settings, saved);
  } catch (e) {
    console.warn('Settings load error:', e);
  }
  applySettings();
}

function saveSettings() {
  try {
    localStorage.setItem('souler-settings', JSON.stringify(AppState.settings));
  } catch (e) {
    console.warn('Settings save error:', e);
  }
  applySettings();
  showToast('Settings saved', 'success');
}

function applySettings() {
  const s = AppState.settings;
  // Volume
  AppState.audioElement.volume = s.volume;
  UI.volumeSlider.value = s.volume;
  UI.settingVolume.value = s.volume;
  UI.volDisplay.textContent = Math.round(s.volume * 100) + '%';
  // Sensitivity — map 0–1 → beat threshold (high sens = lower threshold)
  AppState.beatThreshold = CONFIG.beat.sensitivityHigh - s.sensitivity * (CONFIG.beat.sensitivityHigh - CONFIG.beat.sensitivityLow);
  UI.settingSensitivity.value = s.sensitivity;
  UI.sensDisplay.textContent = Math.round(s.sensitivity * 100) + '%';
  // Speed
  UI.settingSpeed.value = s.animSpeed;
  UI.speedDisplay.textContent = s.animSpeed.toFixed(1) + 'x';
  // API
  UI.settingApiKey.value = s.apiKey;
  UI.settingApiBase.value = s.apiBase;
  UI.settingModel.value = s.model;
  UI.settingSystemPrompt.value = s.systemPrompt;
  // Theme
  setAccentTheme(s.theme, false);
  // Swatches
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === s.theme);
  });
}

/* ─────────────────────────────────────────────────
   CHAT HISTORY PERSISTENCE
   ───────────────────────────────────────────────── */

function loadChatHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem('souler-chat-history') || '[]');
    AppState.chatHistory = Array.isArray(saved) ? saved.slice(-CONFIG.ui.chatHistoryLimit) : [];
  } catch (e) {
    console.warn('Chat history load error:', e);
    AppState.chatHistory = [];
  }
  renderChatHistory();
}

function saveChatHistory() {
  try {
    localStorage.setItem('souler-chat-history', JSON.stringify(AppState.chatHistory.slice(-CONFIG.ui.chatHistoryLimit)));
  } catch (e) {
    console.warn('Chat history save error:', e);
  }
}

function renderChatHistory() {
  const container = UI.chatMessages;
  if (!container) return;
  container.innerHTML = '';

  if (AppState.chatHistory.length === 0) {
    const ph = document.createElement('div');
    ph.className = 'text-gray-500 text-xs text-center mt-8';
    ph.textContent = 'Say "chat" or tap the ⚡ button to start talking to Souler.';
    container.appendChild(ph);
    return;
  }

  AppState.chatHistory.forEach(msg => {
    const role = msg.role === 'assistant' ? 'ai' : 'user';
    const el = document.createElement('div');
    el.className = 'chat-msg ' + role;
    el.innerHTML = `
      <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="bubble">${escapeHtml(msg.content)}</div>
    `;
    container.appendChild(el);
  });
  container.scrollTop = container.scrollHeight;
}

function clearChatHistory() {
  AppState.chatHistory = [];
  localStorage.removeItem('souler-chat-history');
  renderChatHistory();
  showToast('Chat history cleared', 'info');
}

/* ─────────────────────────────────────────────────
   CHARACTER + SETTINGS EXPORT / IMPORT
   ───────────────────────────────────────────────── */

function exportCharacterAndSettings() {
  const s = AppState.settings;

  // Never export the raw API key
  const safeSettings = {
    apiBase: s.apiBase,
    model: s.model,
    volume: s.volume,
    sensitivity: s.sensitivity,
    theme: s.theme,
    animSpeed: s.animSpeed,
    systemPrompt: s.systemPrompt,
  };

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: safeSettings,
    character: AppState.characterImageDataURL
      ? {
          image: AppState.characterImageDataURL,
          note: 'PNG data URL (first frame if original was animated)'
        }
      : null,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `souler-preset-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const hasExportedCharacter = Boolean(payload.character);
  if (hasExportedCharacter) {
    showToast('Preset exported (settings + character)', 'success');
  } else if (AppState.characterMediaType === 'video' && AppState.characterImage) {
    showToast('Preset exported (settings only). MP4 character is not embedded.', 'info');
  } else {
    showToast('Preset exported (settings only)', 'success');
  }
}

function importCharacterAndSettings(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data || data.version !== 1) {
        throw new Error('Unsupported preset version');
      }

      // Apply safe settings
      const incoming = data.settings || {};
      const s = AppState.settings;

      if (incoming.apiBase) s.apiBase = incoming.apiBase;
      if (incoming.model) s.model = incoming.model;
      if (typeof incoming.volume === 'number') s.volume = Math.max(0, Math.min(1, incoming.volume));
      if (typeof incoming.sensitivity === 'number') s.sensitivity = Math.max(0, Math.min(1, incoming.sensitivity));
      if (incoming.theme) s.theme = incoming.theme;
      if (typeof incoming.animSpeed === 'number') s.animSpeed = Math.max(0.3, Math.min(2, incoming.animSpeed)); // keep user-facing range simple
      if (incoming.systemPrompt) s.systemPrompt = incoming.systemPrompt;

      applySettings();

      // Load character if present
      if (data.character && data.character.image) {
        loadCharacterImage(data.character.image); // will also set characterImageDataURL
      }

      saveSettings(); // persist the imported settings
      showToast('Preset imported successfully!', 'success');

    } catch (err) {
      console.error(err);
      showToast('Failed to import preset: ' + err.message, 'error');
    }
  };
  reader.onerror = () => showToast('Could not read preset file', 'error');
  reader.readAsText(file);
}

/* ─────────────────────────────────────────────────
   3. PARTICLE BACKGROUND
   ───────────────────────────────────────────────── */

const pCanvas = document.getElementById('particle-canvas');
const pCtx = pCanvas.getContext('2d');

function resizeParticleCanvas() {
  pCanvas.width  = window.innerWidth;
  pCanvas.height = window.innerHeight;
}

function initParticles(count = CONFIG.particles.initialCount) {
  AppState.particles = [];
  for (let i = 0; i < count; i++) {
    AppState.particles.push(createParticle());
  }
}

function createParticle() {
  return {
    x: Math.random() * pCanvas.width,
    y: Math.random() * pCanvas.height,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * CONFIG.particles.baseSpeed,
    vy: (Math.random() - 0.5) * CONFIG.particles.baseSpeed - 0.1,
    alpha: Math.random() * 0.6 + 0.1,
    life: Math.random(),
    hue: 185 + Math.random() * 40, // cyan-ish range
  };
}

function updateParticles(energy) {
  const speedMult = 1 + energy * 3; // could expose energy multiplier later
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5ff';

  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

  AppState.particles.forEach((p, i) => {
    p.x  += p.vx * speedMult;
    p.y  += p.vy * speedMult;
    p.life -= CONFIG.particles.lifeDecay * speedMult;

    if (p.life <= 0 || p.x < 0 || p.x > pCanvas.width || p.y < 0 || p.y > pCanvas.height) {
      AppState.particles[i] = createParticle();
      return;
    }

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.alpha * p.life})`;
    pCtx.fill();

    // Connect nearby particles with faint lines
    for (let j = i + 1; j < AppState.particles.length; j++) {
      const q = AppState.particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONFIG.particles.connectionDistance) {
        pCtx.beginPath();
        pCtx.moveTo(p.x, p.y);
        pCtx.lineTo(q.x, q.y);
        pCtx.strokeStyle = `hsla(${p.hue}, 100%, 70%, ${0.05 * (1 - dist / CONFIG.particles.connectionDistance) * p.life})`;
        pCtx.lineWidth = 0.5;
        pCtx.stroke();
      }
    }
  });

  // Beat burst: spawn extra particles on loud energy OR strong percussive onset
  if (energy > CONFIG.particles.burstEnergyThreshold || AppState.onset > 0.6) {
    const burst = Math.floor(energy * CONFIG.particles.burstMultiplier);
    for (let b = 0; b < burst; b++) {
      const bp = createParticle();
      bp.x  = pCanvas.width / 2 + (Math.random() - 0.5) * CONFIG.particles.burstSpread;
      bp.y  = pCanvas.height * 0.5 + (Math.random() - 0.5) * CONFIG.particles.burstSpread;
      bp.vx = (Math.random() - 0.5) * CONFIG.particles.burstVelocity;
      bp.vy = (Math.random() - 0.5) * CONFIG.particles.burstVelocity - 0.5;
      bp.r  = Math.random() * (CONFIG.particles.burstRadius[1] - CONFIG.particles.burstRadius[0]) + CONFIG.particles.burstRadius[0];
      bp.alpha = 0.9;
      AppState.particles.push(bp);
      if (AppState.particles.length > CONFIG.particles.maxCount) {
        AppState.particles.splice(0, AppState.particles.length - CONFIG.particles.maxCount);
      }
    }
  }
}

/* ─────────────────────────────────────────────────
   4. CHARACTER RENDERER
   ───────────────────────────────────────────────── */

const charCanvas = document.getElementById('character-canvas');
const charCtx    = charCanvas.getContext('2d');

function resizeCharCanvas() {
  const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.55, CONFIG.character.maxCanvasSize);
  charCanvas.width  = size;
  charCanvas.height = size;
  charCanvas.style.width  = size + 'px';
  charCanvas.style.height = size + 'px';
}

/**
 * Draw the character with current animation state.
 */
function drawCharacter() {
  const ctx  = charCtx;
  const w    = charCanvas.width;
  const h    = charCanvas.height;
  const a    = AppState.anim;
  const energy = AppState.beatEnergy;

  ctx.clearRect(0, 0, w, h);

  // Smoothly lerp animation values
  const spd = AppState.settings.animSpeed;
  a.scale    += (a.targetScale    - a.scale)    * CONFIG.animation.lerp.scale * spd;
  a.rotation += (a.targetRotation - a.rotation) * CONFIG.animation.lerp.rotation * spd;
  a.x        += (a.targetX        - a.x)        * CONFIG.animation.lerp.position * spd;
  a.y        += (a.targetY        - a.y)        * CONFIG.animation.lerp.position * spd;
  a.flashAlpha *= CONFIG.animation.lerp.flash;

  ctx.save();
  ctx.translate(w / 2 + a.x + a.shakeX, h / 2 + a.y + a.shakeY);
  ctx.rotate(a.rotation * Math.PI / 180);
  ctx.scale(a.scale, a.scale);

  if (AppState.characterImage) {
    // Draw the uploaded character
    const media = AppState.characterImage;
    const mediaWidth = AppState.characterMediaType === 'video' ? media.videoWidth : media.naturalWidth;
    const mediaHeight = AppState.characterMediaType === 'video' ? media.videoHeight : media.naturalHeight;
    const safeWidth = mediaWidth || 1;
    const safeHeight = mediaHeight || 1;
    const mediaAspect = safeWidth / safeHeight;
    const drawW = (mediaAspect >= 1) ? w * CONFIG.character.sizeLandscape : w * CONFIG.character.sizePortrait;
    const drawH = drawW / mediaAspect;

    // Shadow / glow
    ctx.shadowColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5ff';
    ctx.shadowBlur  = CONFIG.character.shadowBase + energy * CONFIG.character.shadowEnergy;

    ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);

    // Beat flash overlay
    if (a.flashAlpha > CONFIG.character.flashThreshold) {
      ctx.globalAlpha = a.flashAlpha * CONFIG.character.flashAlphaMul;
      ctx.fillStyle   = a.flashColor;
      ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.globalAlpha = 1;
    }
  } else {
    // Placeholder: animated robot silhouette
    drawPlaceholderCharacter(ctx, w, h, energy);
  }

  ctx.restore();
}

/**
 * Draw an animated SVG-like placeholder when no image is loaded.
 */
function drawPlaceholderCharacter(ctx, w, h, energy) {
  const glow = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5ff';
  const t     = Date.now() / 1000;
  const bob   = Math.sin(t * 1.5) * 4 * (1 + energy * 2);
  const pulse = 0.9 + Math.sin(t * 2) * 0.05 + energy * 0.1;

  ctx.shadowColor = glow;
  ctx.shadowBlur  = 15 + energy * 30;
  ctx.strokeStyle = glow;
  ctx.fillStyle   = 'rgba(0,245,255,0.1)';
  ctx.lineWidth   = 2;

  const sz = Math.min(w, h) * 0.55;
  const cx = 0, cy = bob;

  ctx.save();
  ctx.scale(pulse, pulse);

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - sz * 0.3, sz * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes — blinking
  const blinkScale = AppState.anim.blinkOpen;
  ctx.save();
  ctx.translate(cx - sz * 0.07, cy - sz * 0.32);
  ctx.scale(1, blinkScale);
  ctx.beginPath();
  ctx.arc(0, 0, sz * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx + sz * 0.07, cy - sz * 0.32);
  ctx.scale(1, blinkScale);
  ctx.beginPath();
  ctx.arc(0, 0, sz * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();

  // Mouth — animated when Souler is speaking via TTS
  const mouthY = cy - sz * 0.205;
  if (AppState.isSpeaking) {
    const open = (Math.sin(AppState.anim.speakingPhase * 1.75) * 0.5 + 0.5) * 0.065 + 0.012;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, sz * 0.052, sz * open, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  } else {
    // Closed mouth as a small line
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - sz * 0.032, mouthY);
    ctx.lineTo(cx + sz * 0.032, mouthY);
    ctx.stroke();
    ctx.lineWidth = 2;
  }

  ctx.fillStyle = 'rgba(0,245,255,0.1)';

  // Body
  ctx.beginPath();
  ctx.roundRect(cx - sz * 0.15, cy - sz * 0.1, sz * 0.30, sz * 0.35, sz * 0.04);
  ctx.fill();
  ctx.stroke();

  // Arms (with dance sway)
  const armAngle = AppState.mode === 'dance' || AppState.mode === 'music'
    ? Math.sin(t * 3 * AppState.settings.animSpeed) * 0.4
    : Math.sin(t * 0.8) * 0.1;

  // Left arm
  ctx.save();
  ctx.translate(cx - sz * 0.15, cy);
  ctx.rotate(-0.3 + armAngle);
  ctx.beginPath();
  ctx.roundRect(-sz * 0.06, 0, sz * 0.06, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Right arm
  ctx.save();
  ctx.translate(cx + sz * 0.15, cy);
  ctx.rotate(0.3 - armAngle);
  ctx.beginPath();
  ctx.roundRect(0, 0, sz * 0.06, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Legs
  const legSway = AppState.mode === 'dance' || AppState.mode === 'music'
    ? Math.sin(t * 4 * AppState.settings.animSpeed) * 0.15
    : 0;

  ctx.save();
  ctx.translate(cx - sz * 0.06, cy + sz * 0.25);
  ctx.rotate(-legSway);
  ctx.beginPath();
  ctx.roundRect(-sz * 0.06, 0, sz * 0.07, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(cx + sz * 0.06, cy + sz * 0.25);
  ctx.rotate(legSway);
  ctx.beginPath();
  ctx.roundRect(0, 0, sz * 0.07, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // scale(pulse)
}

/**
 * Load character media (image or MP4) from file or URL into the character slot.
 */
function loadCharacterImage(src, options = {}) {
  const { isVideo = false, isObjectURL = false } = options;
  const previousObjectURL = AppState.characterObjectURL;

  const media = isVideo ? document.createElement('video') : new Image();
  media.crossOrigin = 'anonymous';

  const onLoad = () => {
    if (previousObjectURL && previousObjectURL !== src) {
      URL.revokeObjectURL(previousObjectURL);
    }
    AppState.characterObjectURL = isObjectURL ? src : null;
    AppState.characterImage = media;
    AppState.characterMediaType = isVideo ? 'video' : 'image';

    // Capture a portable PNG data URL for export/import (images only)
    if (!isVideo) {
      try {
        const c = document.createElement('canvas');
        c.width = media.naturalWidth;
        c.height = media.naturalHeight;
        const cx = c.getContext('2d');
        cx.drawImage(media, 0, 0);
        AppState.characterImageDataURL = c.toDataURL('image/png');
      } catch (e) {
        AppState.characterImageDataURL = null;
      }
    } else {
      AppState.characterImageDataURL = null;
      media.play().catch(() => {});
    }

    document.getElementById('upload-overlay').style.display = 'none';

    // Context-aware success message
    if (AppState._pendingCharacterUploadType === 'gif') {
      showToast('GIF loaded — first frame only (no animation)', 'info');
    } else if (AppState._pendingCharacterUploadType === 'mp4' || isVideo) {
      showToast('MP4 loaded — loop animation enabled', 'success');
    } else {
      showToast('Character loaded!', 'success');
    }
    AppState._pendingCharacterUploadType = null;
    triggerFlash();
  };

  media.onerror = () => {
    if (isObjectURL) {
      URL.revokeObjectURL(src);
    }
    AppState._pendingCharacterUploadType = null;
    showToast(isVideo ? 'Failed to load MP4 character' : 'Failed to load image', 'error');
  };

  if (isVideo) {
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.autoplay = true;
    media.preload = 'auto';
    media.onloadeddata = onLoad;
    media.src = src;
  } else {
    media.onload = onLoad;
    media.src = src;
  }
}

/* ─────────────────────────────────────────────────
   5. WEB AUDIO API — BEAT/ENERGY DETECTION
   ───────────────────────────────────────────────── */

function initAudioContext() {
  if (AppState.audioContext) return;
  AppState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  AppState.analyser = AppState.audioContext.createAnalyser();
  AppState.analyser.fftSize = CONFIG.audio.fftSize;
  AppState.analyser.smoothingTimeConstant = CONFIG.audio.playerSmoothing;
  AppState.analyser.connect(AppState.audioContext.destination);
}

/**
 * Connect the <audio> element to the analyser graph.
 * Gracefully handles CORS-blocked cross-origin audio (common with public URLs).
 */
function connectPlayerToAnalyser() {
  initAudioContext();
  if (!AppState.playerSource) {
    try {
      AppState.playerSource = AppState.audioContext.createMediaElementSource(AppState.audioElement);
      AppState.playerSource.connect(AppState.analyser);
    } catch (err) {
      // This is almost always a CORS / tainted media element error
      console.warn('Web Audio connection failed (likely CORS):', err);
      if (AppState.lastAudioSource === 'url') {
        showToast('Beat detection disabled — URL blocked by CORS. Local files work perfectly.', 'info');
      } else {
        showToast('Audio analysis unavailable for this source.', 'info');
      }
      // Playback still works, just no reactive visuals / beat sync
    }
  }
}

/**
 * Compute normalized energy (0–1) from the analyser's frequency data.
 * Also detects beat peaks.
 */
function computeAudioEnergy() {
  if (!AppState.analyser) return 0;

  const bufLen = AppState.analyser.frequencyBinCount;
  const data   = new Uint8Array(bufLen);
  AppState.analyser.getByteFrequencyData(data);

  // Focus on bass/mid frequencies
  const focusBins = Math.floor(bufLen * CONFIG.audio.energyFocusRatio);

  // --- 1. Sustained energy (existing behavior) ---
  let sum = 0;
  for (let i = 0; i < focusBins; i++) {
    sum += data[i];
  }
  const avg = sum / (focusBins * 255);

  AppState.peakEnergy = Math.max(AppState.peakEnergy * CONFIG.audio.peakDecay, avg);
  const normalized = AppState.peakEnergy > CONFIG.audio.minPeak ? Math.min(avg / AppState.peakEnergy, 1) : avg;
  AppState.beatEnergy = normalized;

  // --- 2. Spectral flux onset detection (new — much tighter on real beats) ---
  let flux = 0;
  if (AppState.prevFreqData && AppState.prevFreqData.length === bufLen) {
    for (let i = 0; i < focusBins; i++) {
      const diff = data[i] - AppState.prevFreqData[i];
      if (diff > 0) flux += diff;
    }
  }

  // Normalize flux into ~0–1 range
  const normFlux = Math.min(flux / (focusBins * CONFIG.beat.onsetNormDiv), 1);

  // Peak-normalized + smoothed onset
  AppState.onsetPeak = Math.max(AppState.onsetPeak * CONFIG.beat.onsetDecay, normFlux);
  AppState.onset = (AppState.onsetPeak > 0.005)
    ? Math.min(normFlux / AppState.onsetPeak, 1)
    : 0;

  // Keep copy for next frame (getByteFrequencyData reuses the buffer)
  AppState.prevFreqData = new Uint8Array(data);

  return normalized;
}

/**
 * Update the beat visualizer bars.
 */
function updateVisualizer() {
  if (!AppState.analyser) return;

  const bars = AppState.vizBars;
  const data = new Uint8Array(AppState.analyser.frequencyBinCount);
  AppState.analyser.getByteFrequencyData(data);

  const barCount = bars.length;
  const step = Math.floor(data.length / barCount);
  const maxH = CONFIG.beat.visualizerMaxH;

  bars.forEach((bar, i) => {
    const val = data[i * step] / 255;
    const h   = Math.max(2, val * maxH);
    bar.style.height = h + 'px';
    // Color shifts from accent → pink at high energy
    const hue = 185 - val * CONFIG.beat.visualizerHueShift;
    bar.style.background = `hsl(${hue}, 100%, 60%)`;
    bar.style.boxShadow  = `0 0 ${4 + val * 8}px hsl(${hue}, 100%, 60%)`;
  });
}

/* ─────────────────────────────────────────────────
   6. AUDIO PLAYER
   ───────────────────────────────────────────────── */

function setupAudioPlayer() {
  const audio = AppState.audioElement;

  audio.addEventListener('play', () => {
    AppState.isPlaying = true;
    updatePlayPauseIcon();
    setMode('music');
    connectPlayerToAnalyser();
    // Resume audio context if suspended (browser policy)
    if (AppState.audioContext && AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume();
    }
  });

  audio.addEventListener('pause', () => {
    AppState.isPlaying = false;
    updatePlayPauseIcon();
    resetAudioAnalysis();
    if (!AppState.isMicListening) setMode('idle');
  });

  audio.addEventListener('ended', () => {
    AppState.isPlaying = false;
    updatePlayPauseIcon();
    resetAudioAnalysis();
    if (!AppState.isMicListening) setMode('idle');
  });

  audio.addEventListener('error', () => {
    const err = audio.error;
    let msg = 'Audio error: cannot play this source';
    let type = 'error';

    if (err) {
      switch (err.code) {
        case 1: // MEDIA_ERR_ABORTED
          msg = 'Playback was aborted.';
          type = 'info';
          break;
        case 2: // MEDIA_ERR_NETWORK
          msg = 'Network error while loading audio.';
          break;
        case 3: // MEDIA_ERR_DECODE
          msg = 'Audio file is corrupted or unsupported format.';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          if (AppState.lastAudioSource === 'url') {
            msg = 'Audio URL failed (CORS, 404, or unsupported). Try a direct MP3 link or load a local file.';
          } else {
            msg = 'Audio format not supported by this browser.';
          }
          break;
        default:
          msg = 'Audio error: ' + (err.message || 'cannot play this source');
      }
    }

    showToast(msg, type);
    AppState.isPlaying = false;
    updatePlayPauseIcon();
  });
}

function playAudio() {
  initAudioContext();
  connectPlayerToAnalyser();
  AppState.audioElement.play().catch(err => {
    showToast('Playback blocked — tap play again', 'info');
  });
}

function pauseAudio() {
  AppState.audioElement.pause();
}

function stopAudio() {
  AppState.audioElement.pause();
  AppState.audioElement.currentTime = 0;
  resetAudioAnalysis();
}

function resetAudioAnalysis() {
  AppState.prevFreqData = null;
  AppState.onset = 0;
  AppState.onsetPeak = 0;
  AppState.beatEnergy = 0;
}

function loadAudioFile(file) {
  const url = URL.createObjectURL(file);
  AppState.audioElement.src = url;
  AppState.audioElement.load();
  AppState.lastAudioSource = 'file';
  UI.trackInfo.textContent = file.name;
  showToast('Track loaded: ' + file.name, 'info');
}

function loadAudioURL(url) {
  if (!url) return;
  AppState.audioElement.src = url;
  AppState.audioElement.load();
  AppState.lastAudioSource = 'url';
  const shortName = url.split('/').pop().split('?')[0] || 'URL track';
  UI.trackInfo.textContent = shortName;
  showToast('Loading URL track…', 'info');
}

function updatePlayPauseIcon() {
  UI.iconPlay.style.display  = AppState.isPlaying ? 'none'  : 'block';
  UI.iconPause.style.display = AppState.isPlaying ? 'block' : 'none';
}

/* ─────────────────────────────────────────────────
   7. ENVIRONMENTAL MICROPHONE LISTENER
   ───────────────────────────────────────────────── */

async function toggleEnvMic() {
  if (AppState.isMicListening) {
    stopEnvMic();
  } else {
    await startEnvMic();
  }
}

async function startEnvMic() {
  try {
    initAudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    AppState.micStream = stream;
    AppState.micSource = AppState.audioContext.createMediaStreamSource(stream);

    // Create a separate analyser for mic to avoid mixing with player
    const micAnalyser = AppState.audioContext.createAnalyser();
    micAnalyser.fftSize = CONFIG.audio.fftSize;
    micAnalyser.smoothingTimeConstant = CONFIG.audio.micSmoothing;
    AppState.micSource.connect(micAnalyser);

    // Store mic analyser; we'll use it in the animation loop
    AppState.micAnalyser = micAnalyser;

    AppState.isMicListening = true;
    AppState.micConfirmCount = 0;
    UI.btnMic.classList.add('active');
    UI.micLabel.textContent = 'MIC ON';
    showToast('Environmental mic active', 'info');

    // Resume context
    if (AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume();
    }
  } catch (err) {
    console.error('Mic error:', err);
    showPermissionOverlay('microphone');
  }
}

function stopEnvMic() {
  if (AppState.micStream) {
    AppState.micStream.getTracks().forEach(t => t.stop());
    AppState.micStream = null;
  }
  if (AppState.micSource) {
    AppState.micSource.disconnect();
    AppState.micSource = null;
  }
  AppState.micAnalyser = null;
  AppState.isMicListening = false;
  AppState.envMusicDetected = false;
  AppState.micEnergy = 0;
  AppState.micConfirmCount = 0;
  UI.btnMic.classList.remove('active');
  UI.micLabel.textContent = 'MIC';
  if (UI.micLevelMeter) UI.micLevelMeter.classList.add('hidden');
  if (!AppState.isPlaying) setMode('idle');
  showToast('Microphone off', 'info');
}

/**
 * Check microphone energy to auto-detect music in the environment.
 */
function checkEnvMic() {
  if (!AppState.micAnalyser) return;

  const data = new Uint8Array(AppState.micAnalyser.frequencyBinCount);
  AppState.micAnalyser.getByteFrequencyData(data);

  // Overall energy for the UI meter
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const avg = sum / (data.length * 255);
  AppState.micEnergy = avg;

  // Update the live level meter in the UI
  updateMicLevelMeter(avg);

  // Smarter music detection:
  // - Slightly bass-weighted (first 35% of spectrum)
  // - Requires sustained activity (hysteresis) to avoid speech/false triggers
  const focusBins = Math.floor(data.length * 0.35);
  let bassSum = 0;
  for (let i = 0; i < focusBins; i++) bassSum += data[i];
  const bassAvg = bassSum / (focusBins * 255);

  const threshold = AppState.beatThreshold * CONFIG.beat.envMicFactor;

  const isAbove = bassAvg > threshold * 0.85; // a bit more forgiving on bass

  if (isAbove) {
    AppState.micConfirmCount = Math.min(AppState.micConfirmCount + 1, 30);
  } else {
    AppState.micConfirmCount = Math.max(AppState.micConfirmCount - 2, 0); // decay faster when quiet
  }

  const confirmedMusic = AppState.micConfirmCount > 12; // ~200ms sustained

  if (confirmedMusic) {
    if (!AppState.envMusicDetected) {
      AppState.envMusicDetected = true;
      setMode('music');
      showToast('Music detected!', 'info');
    }
    if (!AppState.isPlaying) {
      // Feed the character animation from the mic
      AppState.beatEnergy = Math.min(bassAvg / CONFIG.beat.envMicCap, 1);
    }
  } else {
    if (AppState.envMusicDetected) {
      AppState.envMusicDetected = false;
      if (!AppState.isPlaying) setMode('idle');
    }
  }
}

function updateMicLevelMeter(energy) {
  const meter = UI.micLevelMeter;
  if (!meter) return;

  // Show meter only when mic is actively listening
  if (AppState.isMicListening) {
    meter.classList.remove('hidden');
    // Map 0–0.6+ energy to 0–100% fill
    const fill = Math.min(energy / 0.55, 1) * 100;
    meter.style.setProperty('--fill', fill + '%');
    // Dynamic color: cyan → pink as it gets louder (more "musical")
    const hue = 185 - Math.min(energy * 70, 55);
    meter.style.background = `hsl(${hue}, 100%, 55%)`;
    meter.style.boxShadow = `0 0 5px hsl(${hue}, 100%, 55%)`;
  } else {
    meter.classList.add('hidden');
  }
}

/* ─────────────────────────────────────────────────
   8. VOICE COMMANDS
   ───────────────────────────────────────────────── */

let recognition = null;
let recognitionChatMode = false;

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn('SpeechRecognition not supported');
    return;
  }
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    AppState.isVoiceListening = true;
    UI.btnVoice.classList.add('listening');
    showVoiceFeedback('Listening…');
  };

  recognition.onend = () => {
    AppState.isVoiceListening = false;
    UI.btnVoice.classList.remove('listening');
    hideVoiceFeedback();
  };

  recognition.onerror = (e) => {
    AppState.isVoiceListening = false;
    UI.btnVoice.classList.remove('listening');
    hideVoiceFeedback();
    if (e.error !== 'no-speech') {
      showToast('Voice error: ' + e.error, 'error');
    }
  };

  recognition.onresult = (e) => {
    const results = Array.from(e.results[0]);
    const transcript = results[0].transcript.trim().toLowerCase();
    showVoiceFeedback('"' + transcript + '"');
    setTimeout(hideVoiceFeedback, 2500);

    if (recognitionChatMode) {
      // Send to AI chat
      recognitionChatMode = false;
      sendChatMessage(transcript);
    } else {
      handleVoiceCommand(transcript);
    }
  };
}

function startVoiceRecognition(chatMode = false) {
  if (!recognition) {
    showToast('Voice recognition not supported in this browser', 'error');
    return;
  }
  recognitionChatMode = chatMode;
  try {
    recognition.start();
  } catch (e) {
    console.warn('Recognition already running:', e);
  }
}

/**
 * Parse and dispatch voice commands.
 */
function handleVoiceCommand(text) {
  const cmd = text.toLowerCase();

  if (matchCmd(cmd, ['dance', 'start dancing', 'let\'s dance'])) {
    setMode('dance'); speak('Let\'s dance!');
  } else if (matchCmd(cmd, ['idle', 'stop dancing', 'rest', 'chill'])) {
    setMode('idle'); speak('Chilling out.');
  } else if (matchCmd(cmd, ['play', 'start music', 'play music'])) {
    playAudio(); speak('Playing music!');
  } else if (matchCmd(cmd, ['pause', 'stop music', 'stop playing'])) {
    pauseAudio(); speak('Paused.');
  } else if (matchCmd(cmd, ['stop'])) {
    stopAudio(); speak('Stopped.');
  } else if (matchCmd(cmd, ['volume up', 'louder', 'turn it up'])) {
    adjustVolume(0.1); speak('Volume up!');
  } else if (matchCmd(cmd, ['volume down', 'quieter', 'turn it down'])) {
    adjustVolume(-0.1); speak('Volume down.');
  } else if (matchCmd(cmd, ['mute', 'silence'])) {
    AppState.audioElement.volume = 0; AppState.settings.volume = 0; applySettings(); speak('Muted.');
  } else if (matchCmd(cmd, ['unmute'])) {
    AppState.settings.volume = 0.8; applySettings(); speak('Unmuted!');
  } else if (matchCmd(cmd, ['chat', 'talk to me', 'let\'s chat', 'hey souler', 'hello souler'])) {
    openChatPanel(); speak('What\'s up?'); setTimeout(() => startVoiceRecognition(true), 1500);
  } else if (matchCmd(cmd, ['settings', 'open settings'])) {
    openSettings();
  } else if (matchCmd(cmd, ['microphone', 'start listening', 'listen'])) {
    startEnvMic();
  } else if (matchCmd(cmd, ['close', 'never mind', 'cancel'])) {
    closeChatPanel(); closeSettings();
  } else if (matchCmd(cmd, ['spin', 'rotate'])) {
    triggerSpin();
  } else if (matchCmd(cmd, ['flash', 'light up'])) {
    triggerFlash();
  } else if (matchCmd(cmd, ['shake', 'tremble'])) {
    triggerShake();
  } else {
    // Unknown command — try AI chat if key is set
    if (AppState.settings.apiKey) {
      sendChatMessage(text);
    } else {
      showToast('Unknown command: "' + text + '"', 'info');
    }
  }
}

function matchCmd(text, patterns) {
  return patterns.some(p => text.includes(p));
}

function adjustVolume(delta) {
  AppState.settings.volume = Math.max(0, Math.min(1, AppState.settings.volume + delta));
  applySettings();
}

/* ─────────────────────────────────────────────────
   9. AI CHAT (OpenAI-compatible)
   ───────────────────────────────────────────────── */

async function sendChatMessage(text) {
  if (!text.trim()) return;

  const apiKey  = AppState.settings.apiKey;
  if (!apiKey) {
    showToast('Set your API key in Settings first', 'info');
    openSettings();
    return;
  }

  // Push user message to history and UI
  AppState.chatHistory.push({ role: 'user', content: text });
  addChatBubble('user', text);
  saveChatHistory();

  // Show typing indicator
  const typingId = addTypingIndicator();
  showChatBubbleOnCharacter('…');

  const messages = [
    { role: 'system', content: AppState.settings.systemPrompt },
    ...AppState.chatHistory.slice(-CONFIG.ui.aiPromptTurns), // keep last N turns for context
  ];

  try {
    const res = await fetch(AppState.settings.apiBase.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: AppState.settings.model || 'gpt-4o-mini',
        messages,
        max_tokens: CONFIG.ui.aiMaxTokens,
        temperature: 0.8,
      }),
    });

    removeTypingIndicator(typingId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'API error ' + res.status);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '(no response)';

    AppState.chatHistory.push({ role: 'assistant', content: reply });
    addChatBubble('ai', reply);
    showChatBubbleOnCharacter(reply);
    speak(reply);
    saveChatHistory();
  } catch (err) {
    removeTypingIndicator(typingId);
    const errMsg = 'AI error: ' + err.message;
    addChatBubble('ai', errMsg);
    showToast(errMsg, 'error');
    console.error(err);
  }
}

function addChatBubble(role, text) {
  const container = UI.chatMessages;
  // Remove "no messages" placeholder if present
  const placeholder = container.querySelector('div.text-gray-500');
  if (placeholder) placeholder.remove();

  const el = document.createElement('div');
  el.className = 'chat-msg ' + role;
  el.innerHTML = `
    <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
  const id = 'typing-' + Date.now();
  const el = document.createElement('div');
  el.className = 'chat-msg ai';
  el.id = id;
  el.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble flex gap-1 items-center">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  UI.chatMessages.appendChild(el);
  UI.chatMessages.scrollTop = UI.chatMessages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function showChatBubbleOnCharacter(text) {
  const bubble = document.getElementById('chat-bubble');
  bubble.textContent = text.length > 80 ? text.slice(0, 77) + '…' : text;
  bubble.classList.remove('hidden');
  clearTimeout(bubble._timeout);
  bubble._timeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
}

/* ─────────────────────────────────────────────────
   10. UI CONTROLS & EVENT WIRING
   ───────────────────────────────────────────────── */

// Cache DOM elements
const UI = {
  btnSettings:       document.getElementById('btn-settings'),
  btnCloseSettings:  document.getElementById('btn-close-settings'),
  settingsPanel:     document.getElementById('settings-panel'),
  settingsBackdrop:  document.getElementById('settings-backdrop'),
  btnSaveSettings:   document.getElementById('btn-save-settings'),

  settingApiKey:     document.getElementById('setting-api-key'),
  settingApiBase:    document.getElementById('setting-api-base'),
  settingModel:      document.getElementById('setting-model'),
  settingVolume:     document.getElementById('setting-volume'),
  settingSensitivity:document.getElementById('setting-sensitivity'),
  settingSpeed:      document.getElementById('setting-speed'),
  settingSystemPrompt: document.getElementById('setting-system-prompt'),

  volDisplay:        document.getElementById('vol-display'),
  sensDisplay:       document.getElementById('sens-display'),
  speedDisplay:      document.getElementById('speed-display'),

  btnPlayPause:      document.getElementById('btn-play-pause'),
  btnStop:           document.getElementById('btn-stop'),
  btnLoadFile:       document.getElementById('btn-load-file'),
  audioFileInput:    document.getElementById('audio-file-input'),
  urlInput:          document.getElementById('url-input'),
  btnLoadURL:        document.getElementById('btn-load-url'),
  volumeSlider:      document.getElementById('volume-slider'),
  trackInfo:         document.getElementById('track-info'),
  iconPlay:          document.getElementById('icon-play'),
  iconPause:         document.getElementById('icon-pause'),

  btnMic:            document.getElementById('btn-mic'),
  micLabel:          document.getElementById('mic-label'),
  micLevelMeter:     document.getElementById('mic-level-meter'),
  btnVoice:          document.getElementById('btn-voice'),
  btnModeToggle:     document.getElementById('btn-mode-toggle'),
  modeToggleLabel:   document.getElementById('mode-toggle-label'),
  btnChat:           document.getElementById('btn-chat'),

  modeBadge:         document.getElementById('mode-badge'),
  modeLabel:         document.getElementById('mode-label'),
  modeDot:           document.getElementById('mode-dot'),

  fileInput:         document.getElementById('file-input'),
  btnReupload:       document.getElementById('btn-reupload'),
  btnExportPreset:   document.getElementById('btn-export-preset'),
  btnImportPreset:   document.getElementById('btn-import-preset'),
  presetFileInput:   document.getElementById('preset-file-input'),

  chatPanel:         document.getElementById('chat-panel'),
  btnCloseChat:      document.getElementById('btn-close-chat'),
  btnClearChat:      document.getElementById('btn-clear-chat'),
  chatMessages:      document.getElementById('chat-messages'),
  chatInput:         document.getElementById('chat-input'),
  btnSendChat:       document.getElementById('btn-send-chat'),
  btnVoiceChat:      document.getElementById('btn-voice-chat'),

  toastContainer:    document.getElementById('toast-container'),
  voiceFeedback:     document.getElementById('voice-feedback'),
  glowRingOuter:     document.getElementById('glow-ring-outer'),
  glowRingInner:     document.getElementById('glow-ring-inner'),
  visualizer:        document.getElementById('visualizer'),
  uploadOverlay:     document.getElementById('upload-overlay'),
  uploadHint:        document.getElementById('upload-hint'),

  permOverlay:       document.getElementById('perm-overlay'),
  permAllow:         document.getElementById('perm-allow'),
  permDeny:          document.getElementById('perm-deny'),
};

function wireEvents() {
  // ── Settings ──
  UI.btnSettings.addEventListener('click', openSettings);
  UI.btnCloseSettings.addEventListener('click', closeSettings);
  UI.settingsBackdrop.addEventListener('click', closeSettings);
  UI.btnSaveSettings.addEventListener('click', () => {
    AppState.settings.apiKey     = UI.settingApiKey.value.trim();
    AppState.settings.apiBase    = UI.settingApiBase.value.trim() || 'https://api.openai.com/v1';
    AppState.settings.model      = UI.settingModel.value.trim()   || 'gpt-4o-mini';
    AppState.settings.volume     = parseFloat(UI.settingVolume.value);
    AppState.settings.sensitivity= parseFloat(UI.settingSensitivity.value);
    AppState.settings.animSpeed  = parseFloat(UI.settingSpeed.value);
    AppState.settings.systemPrompt = UI.settingSystemPrompt.value;
    saveSettings();
    closeSettings();
  });

  // Live sliders
  UI.settingVolume.addEventListener('input', () => {
    UI.volDisplay.textContent = Math.round(UI.settingVolume.value * 100) + '%';
    AppState.audioElement.volume = parseFloat(UI.settingVolume.value);
  });
  UI.settingSensitivity.addEventListener('input', () => {
    UI.sensDisplay.textContent = Math.round(UI.settingSensitivity.value * 100) + '%';
  });
  UI.settingSpeed.addEventListener('input', () => {
    UI.speedDisplay.textContent = parseFloat(UI.settingSpeed.value).toFixed(1) + 'x';
  });

  // Theme swatches
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setAccentTheme(btn.dataset.theme, true);
      AppState.settings.theme = btn.dataset.theme;
    });
  });

  // ── Audio Player ──
  UI.btnPlayPause.addEventListener('click', () => {
    initAudioContext();
    if (AppState.isPlaying) pauseAudio(); else playAudio();
  });
  UI.btnStop.addEventListener('click', stopAudio);
  UI.btnLoadFile.addEventListener('click', () => UI.audioFileInput.click());
  UI.audioFileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadAudioFile(e.target.files[0]);
    e.target.value = '';
  });
  UI.btnLoadURL.addEventListener('click', () => loadAudioURL(UI.urlInput.value.trim()));
  UI.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadAudioURL(UI.urlInput.value.trim());
  });
  UI.volumeSlider.addEventListener('input', () => {
    AppState.settings.volume = parseFloat(UI.volumeSlider.value);
    AppState.audioElement.volume = AppState.settings.volume;
    UI.settingVolume.value = AppState.settings.volume;
    UI.volDisplay.textContent = Math.round(AppState.settings.volume * 100) + '%';
  });

  // ── Character Upload ──
  UI.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
      const isImage = file.type.startsWith('image/');
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

      if (!isImage && !isMp4) {
        showToast('Unsupported character format. Use PNG/JPG/WEBP/GIF or MP4.', 'error');
        e.target.value = '';
        return;
      }

      if (file.size > CONFIG.character.maxUploadBytes) {
        showToast('Character file is too large (max 25MB).', 'error');
        e.target.value = '';
        return;
      }

      // Store temporary flag so loadCharacterImage can show the right message
      AppState._pendingCharacterUploadType = isGif ? 'gif' : (isMp4 ? 'mp4' : null);
      loadCharacterImage(URL.createObjectURL(file), { isVideo: isMp4, isObjectURL: true });
    }
    e.target.value = '';
  });
  UI.btnReupload.addEventListener('click', () => {
    closeSettings();
    UI.fileInput.click();
  });

  // Export / Import preset
  UI.btnExportPreset?.addEventListener('click', () => {
    exportCharacterAndSettings();
  });
  UI.btnImportPreset?.addEventListener('click', () => {
    UI.presetFileInput?.click();
  });
  UI.presetFileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importCharacterAndSettings(e.target.files[0]);
    }
    e.target.value = '';
  });

  charCanvas.addEventListener('click', () => {
    if (!AppState.characterImage) UI.fileInput.click();
    else triggerFlash();
  });

  // ── Mode Toggle ──
  UI.btnModeToggle.addEventListener('click', () => {
    if (AppState.mode === 'dance' || AppState.mode === 'music') {
      setMode('idle');
    } else {
      setMode('dance');
    }
  });

  // ── Mic ──
  UI.btnMic.addEventListener('click', () => {
    initAudioContext();
    toggleEnvMic();
  });

  // ── Voice ──
  UI.btnVoice.addEventListener('click', () => startVoiceRecognition(false));

  // ── Chat ──
  UI.btnChat.addEventListener('click', openChatPanel);
  UI.btnCloseChat.addEventListener('click', closeChatPanel);
  UI.btnClearChat?.addEventListener('click', clearChatHistory);
  UI.btnSendChat.addEventListener('click', () => {
    const text = UI.chatInput.value.trim();
    if (text) {
      sendChatMessage(text);
      UI.chatInput.value = '';
    }
  });
  UI.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = UI.chatInput.value.trim();
      if (text) { sendChatMessage(text); UI.chatInput.value = ''; }
    }
  });
  UI.btnVoiceChat.addEventListener('click', () => {
    openChatPanel();
    startVoiceRecognition(true);
  });

  // ── Permission overlay ──
  UI.permAllow.addEventListener('click', () => {
    closePermissionOverlay();
    startEnvMic();
  });
  UI.permDeny.addEventListener('click', closePermissionOverlay);

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') return;
    switch (e.code) {
      case 'Space':      e.preventDefault(); if (AppState.isPlaying) pauseAudio(); else playAudio(); break;
      case 'KeyD':       setMode(AppState.mode === 'dance' ? 'idle' : 'dance'); break;
      case 'KeyV':       startVoiceRecognition(false); break;
      case 'KeyC':       openChatPanel(); break;
      case 'KeyM':       toggleEnvMic(); break;
      case 'KeyS':       openSettings(); break;
      case 'Escape':     closeSettings(); closeChatPanel(); break;
    }
  });
}

function openSettings() {
  UI.settingsPanel.classList.remove('hidden');
  UI.settingsPanel.classList.add('flex');
}

function closeSettings() {
  UI.settingsPanel.classList.add('hidden');
  UI.settingsPanel.classList.remove('flex');
}

function openChatPanel() {
  UI.chatPanel.classList.remove('hidden');
  UI.chatPanel.classList.add('flex');
  UI.chatInput.focus();
  setMode('chat');
}

function closeChatPanel() {
  UI.chatPanel.classList.add('hidden');
  UI.chatPanel.classList.remove('flex');
  if (!AppState.isPlaying) setMode('idle');
}

function showPermissionOverlay(type) {
  if (type === 'microphone') {
    document.getElementById('perm-icon').textContent  = '🎤';
    document.getElementById('perm-title').textContent = 'Microphone Access';
    document.getElementById('perm-message').textContent =
      'Souler needs microphone access to listen for music and voice commands.';
  }
  UI.permOverlay.classList.remove('hidden');
  UI.permOverlay.classList.add('flex');
}

function closePermissionOverlay() {
  UI.permOverlay.classList.add('hidden');
  UI.permOverlay.classList.remove('flex');
}

/* ─────────────────────────────────────────────────
   11. ANIMATION LOOP
   ───────────────────────────────────────────────── */

let lastFrame = 0;

function animationLoop(timestamp) {
  AppState.animFrame = requestAnimationFrame(animationLoop);

  const delta = Math.min((timestamp - lastFrame) / 1000, CONFIG.ui.animationDeltaCap); // seconds, capped
  lastFrame = timestamp;

  // 1) Compute audio energy
  let energy = 0;
  if (AppState.isPlaying || AppState.envMusicDetected) {
    energy = computeAudioEnergy();
  }

  // 2) Check env mic
  if (AppState.isMicListening) checkEnvMic();

  // 3) Update character animation targets
  updateCharacterAnimation(energy, delta);

  // 4) Draw character
  drawCharacter();

  // 5) Update visualizer
  if (AppState.isPlaying || AppState.envMusicDetected) {
    updateVisualizer();
  } else {
    // Fade bars to zero
    UI.vizBars.forEach(b => { b.style.height = '2px'; });
  }

  // 6) Update glow rings
  updateGlowRings(energy);

  // 7) Particle background
  updateParticles(energy);
}

/**
 * Set character animation targets based on current mode and audio energy.
 */
function updateCharacterAnimation(energy, delta) {
  const a   = AppState.anim;
  const spd = AppState.settings.animSpeed;
  const t   = Date.now() / 1000;

  // Reset shake
  a.shakeX = 0;
  a.shakeY = 0;

  switch (AppState.mode) {
    case 'idle': {
      // Gentle breathing: scale oscillation
      a.breathPhase += delta * CONFIG.animation.idle.breathSpeed * spd;
      const breathScale = 1 + Math.sin(a.breathPhase) * CONFIG.animation.idle.breathAmount;
      a.targetScale = breathScale;
      a.targetRotation = 0;
      a.targetX = 0;
      a.targetY = Math.sin(a.breathPhase * 0.5) * CONFIG.animation.idle.floatAmount;

      // Blinking
      a.blinkTimer += delta;
      if (a.blinkTimer > CONFIG.animation.idle.blinkMin + Math.random() * CONFIG.animation.idle.blinkRandom) {
        a.blinkTimer = 0;
        triggerBlink();
      }
      break;
    }

    case 'dance': {
      // Energetic bouncing
      a.bouncePhase += delta * CONFIG.animation.dance.bounceSpeed * spd;
      a.swayPhase   += delta * CONFIG.animation.dance.swaySpeed * spd;
      a.targetScale = 1 + Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.dance.scaleAmount;
      a.targetY     = -Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.dance.yAmount;
      a.targetX     = Math.sin(a.swayPhase) * CONFIG.animation.dance.xAmount;
      a.targetRotation = Math.sin(a.swayPhase * 0.7) * CONFIG.animation.dance.rotAmount;
      break;
    }

    case 'music': {
      // Beat-reactive
      a.bouncePhase += delta * (CONFIG.animation.music.bounceBase + energy * CONFIG.animation.music.bounceEnergy) * spd;
      a.swayPhase   += delta * (CONFIG.animation.music.swayBase + energy * CONFIG.animation.music.swayEnergy) * spd;

      // Use BOTH sustained energy AND spectral flux onset for tight, musical reaction
      const strongBeat = (energy > AppState.beatThreshold) || (AppState.onset > CONFIG.beat.onsetTrigger);

      if (strongBeat) {
        // On real percussive hits (onset) we get snappier pops even if RMS energy is moderate
        const pop = Math.max(energy, AppState.onset * 0.9);
        a.targetScale = 1 + pop * CONFIG.animation.music.beatScale;
        a.targetY     = -pop * CONFIG.animation.music.beatY;
        a.flashAlpha  = Math.max(a.flashAlpha, pop);
        a.flashColor  = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5ff';
      } else {
        a.targetScale = 1 + Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.music.idleScale;
        a.targetY     = -Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.music.idleY;
      }

      a.targetX     = Math.sin(a.swayPhase) * (CONFIG.animation.music.xBase + energy * CONFIG.animation.music.xEnergy);
      a.targetRotation = Math.sin(a.swayPhase * 0.8) * (CONFIG.animation.music.rotBase + energy * CONFIG.animation.music.rotEnergy);

      // Shake on strong energy OR strong onset (much more responsive to drums)
      const doShake = (energy > CONFIG.animation.music.shakeThreshold) || (AppState.onset > 0.65);
      if (doShake) {
        const shakeMag = Math.max(energy, AppState.onset) * CONFIG.animation.music.shakeAmount;
        a.shakeX = (Math.random() - 0.5) * shakeMag;
        a.shakeY = (Math.random() - 0.5) * shakeMag * 0.7;
      }
      break;
    }

    case 'chat': {
      // Subtle "talking" bob
      a.breathPhase += delta * 1.5 * spd;
      a.targetScale = 1 + Math.sin(a.breathPhase * 2) * 0.015;
      a.targetY     = Math.sin(a.breathPhase) * 5;
      a.targetX     = 0;
      a.targetRotation = Math.sin(a.breathPhase * 0.5) * 1;
      break;
    }
  }

  // Speaking overlay — extra head nods + phase advance while TTS is active
  // This makes the character feel alive during both voice commands and AI chat replies
  if (AppState.isSpeaking) {
    a.speakingPhase += delta * 15 * spd;           // mouth cycle speed
    const talkBob = Math.sin(a.speakingPhase * 1.55) * 3.2;
    a.targetY += talkBob;                          // rhythmic nodding
    a.breathPhase += delta * 1.8;                  // slightly faster breathing
  }
}

function updateGlowRings(energy) {
  const size = Math.min(window.innerWidth, window.innerHeight);
  const base = size * CONFIG.glow.outerBase;
  const outer = base + energy * base * CONFIG.glow.outerEnergy;
  const inner = base * CONFIG.glow.innerBase + energy * base * CONFIG.glow.innerEnergy;

  UI.glowRingOuter.style.width  = outer + 'px';
  UI.glowRingOuter.style.height = outer + 'px';
  UI.glowRingInner.style.width  = inner + 'px';
  UI.glowRingInner.style.height = inner + 'px';

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5ff';
  const glowSize = CONFIG.glow.sizeBase + energy * CONFIG.glow.sizeEnergy;
  UI.glowRingOuter.style.boxShadow =
    `0 0 ${glowSize}px rgba(${hexToRgb(accent)}, ${CONFIG.glow.alphaBase + energy * CONFIG.glow.alphaEnergy}),
     inset 0 0 ${glowSize * 0.5}px rgba(${hexToRgb(accent)}, ${0.1 + energy * 0.2})`;
  UI.glowRingOuter.style.borderColor = `rgba(${hexToRgb(accent)}, ${0.3 + energy * CONFIG.glow.alphaEnergy})`;
}

/* ─────────────────────────────────────────────────
   12. UTILITY HELPERS
   ───────────────────────────────────────────────── */

function setMode(mode) {
  AppState.mode = mode;
  UI.modeBadge.dataset.mode = mode;
  UI.modeLabel.textContent = mode.toUpperCase();

  // Update toggle button
  const isDancing = mode === 'dance' || mode === 'music';
  UI.modeToggleLabel.textContent = isDancing ? 'IDLE' : 'DANCE';
}

function speak(text) {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  AppState.isSpeaking = false;

  const utt = new SpeechSynthesisUtterance(text);
  utt.rate   = 1.05;
  utt.pitch  = 1.1;
  utt.volume = 0.9;

  // Try to pick a nice voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
  if (preferred) utt.voice = preferred;

  // Track speaking state for visual mouth animation
  utt.onstart = () => { AppState.isSpeaking = true; };
  utt.onend   = () => { AppState.isSpeaking = false; AppState.anim.speakingPhase = 0; };
  utt.onerror = () => { AppState.isSpeaking = false; AppState.anim.speakingPhase = 0; };

  AppState.isSpeaking = true;
  AppState.anim.speakingPhase = 0;

  window.speechSynthesis.speak(utt);
}

function showToast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  UI.toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease-in forwards';
    setTimeout(() => el.remove(), 350);
  }, 3000);
}

function showVoiceFeedback(text) {
  UI.voiceFeedback.textContent = text;
  UI.voiceFeedback.classList.remove('hidden');
}

function hideVoiceFeedback() {
  UI.voiceFeedback.classList.add('hidden');
}

function triggerFlash() {
  AppState.anim.flashAlpha = 0.8;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00f5ff';
  AppState.anim.flashColor = accent;
}

function triggerSpin() {
  AppState.anim.targetRotation = AppState.anim.rotation + 360;
  setTimeout(() => { AppState.anim.targetRotation = 0; AppState.anim.rotation = 0; }, 700);
}

function triggerShake() {
  let count = 0;
  const id = setInterval(() => {
    AppState.anim.shakeX = (Math.random() - 0.5) * 14;
    AppState.anim.shakeY = (Math.random() - 0.5) * 8;
    if (++count > 10) { clearInterval(id); AppState.anim.shakeX = 0; AppState.anim.shakeY = 0; }
  }, 60);
}

function triggerBlink() {
  AppState.anim.blinkOpen = 0;
  setTimeout(() => { AppState.anim.blinkOpen = 0.2; }, 80);
  setTimeout(() => { AppState.anim.blinkOpen = 1; },   160);
}

function setAccentTheme(theme, save = false) {
  const themes = {
    neon:   '#00f5ff',
    pink:   '#ff2d78',
    purple: '#a855f7',
    green:  '#39ff14',
    yellow: '#ffd700',
  };
  const color = themes[theme] || themes.neon;
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color));
  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = '#0a0a0f';
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initVisualizerBars() {
  UI.visualizer.innerHTML = '';
  AppState.vizBars = [];
  const barCount = Math.floor(window.innerWidth / 8);
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'viz-bar';
    UI.visualizer.appendChild(bar);
    AppState.vizBars.push(bar);
  }
}

/* ─────────────────────────────────────────────────
   13. PWA & INITIALIZATION
   ───────────────────────────────────────────────── */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      // SW is optional — not a blocking error
      console.info('SW registration skipped:', err.message);
    });
  }
}

function handleResize() {
  resizeParticleCanvas();
  resizeCharCanvas();
  initVisualizerBars();
}

function init() {
  // Load saved settings
  loadSettings();

  // Load persisted chat history (after settings + DOM)
  loadChatHistory();

  // Resize and set up canvases
  resizeParticleCanvas();
  resizeCharCanvas();

  // Init particles
  initParticles();

  // Init visualizer bars
  initVisualizerBars();

  // Set up audio player events
  setupAudioPlayer();

  // Wire all UI events
  wireEvents();

  // Set up speech recognition
  initSpeechRecognition();

  // Start animation loop
  animationLoop(0);

  // Set initial mode
  setMode('idle');

  // Load voices async
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });

  // Handle resize
  window.addEventListener('resize', debounce(handleResize, CONFIG.ui.resizeDebounce));

  // Register SW
  registerServiceWorker();

  // Welcome message
  setTimeout(() => showToast('Welcome to Souler! 🎵 Tap to upload your character.', 'info'), 800);
}

function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

// Boot
document.addEventListener('DOMContentLoaded', init);
