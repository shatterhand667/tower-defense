const Audio = (() => {
  let _ctx        = null;
  let _sfxGain    = null;
  let _musicGain  = null;
  let _ready      = false;
  let _melodyTimer = null;

  // Per-sound cooldown to avoid spam (ms)
  const COOLDOWN = { arrow: 80, cannon: 120, sniper: 150, goblinDeath: 60, goblinAttack: 200 };
  const _lastPlayed = {};

  // ─── Init (deferred until first click — browser policy) ───────────────────
  function init() {
    document.addEventListener('click', _start, { once: true });
  }

  function _start() {
    if (_ctx) { _ctx.resume(); return; }
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = _ctx.createGain(); master.gain.value = 1.0; master.connect(_ctx.destination);
      _sfxGain   = _ctx.createGain(); _sfxGain.gain.value   = 0.55; _sfxGain.connect(master);
      _musicGain = _ctx.createGain(); _musicGain.gain.value = 0.28; _musicGain.connect(master);
      _ready = true;
      _startMusic();
    } catch(e) { console.warn('Audio unavailable:', e); }
  }

  // ─── MUSIC ────────────────────────────────────────────────────────────────
  function _startMusic() {
    _brownNoise();
    _bassDrone();
    _scheduleMelody();
  }

  function _brownNoise() {
    const rate = _ctx.sampleRate;
    const buf  = _ctx.createBuffer(1, rate * 8, rate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * w) / 1.02;
      last = data[i];
      data[i] *= 3.2;
    }
    const src = _ctx.createBufferSource();
    src.buffer = buf; src.loop = true;

    const lo = _ctx.createBiquadFilter(); lo.type = 'lowpass';  lo.frequency.value = 800;
    const hi = _ctx.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 120;
    const g  = _ctx.createGain();         g.gain.value = 0.10;

    src.connect(lo); lo.connect(hi); hi.connect(g); g.connect(_musicGain);
    src.start();
  }

  function _bassDrone() {
    const freqs = [55, 82.5, 110]; // A1, E2, A2
    freqs.forEach((f, i) => {
      const osc = _ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = _ctx.createGain();
      g.gain.value = i === 0 ? 0.22 : 0.07;
      osc.connect(g); g.connect(_musicGain);
      osc.start();
    });
  }

  // A minor pentatonic: A3 C4 D4 E4 G4 A4 C5
  const MELODY = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

  function _scheduleMelody() {
    if (!_ready) return;
    const freq   = MELODY[Math.floor(Math.random() * MELODY.length)];
    const now    = _ctx.currentTime;
    const osc    = _ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = freq;
    const g = _ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(g); g.connect(_musicGain);
    osc.start(now); osc.stop(now + 2.0);

    const next = 600 + Math.random() * 2400;
    _melodyTimer = setTimeout(_scheduleMelody, next);
  }

  // ─── SFX helpers ──────────────────────────────────────────────────────────
  function _osc(freq, type, startT, stopT, peakGain, dst) {
    const o = _ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = _ctx.createGain();
    g.gain.setValueAtTime(0, startT);
    g.gain.linearRampToValueAtTime(peakGain, startT + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, stopT);
    o.connect(g); g.connect(dst || _sfxGain);
    o.start(startT); o.stop(stopT);
    return { o, g };
  }

  function _noise(duration, peakGain, freqLo, freqHi, dst) {
    const rate = _ctx.sampleRate;
    const buf  = _ctx.createBuffer(1, Math.ceil(rate * duration), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = _ctx.createBufferSource(); src.buffer = buf;
    const lo  = _ctx.createBiquadFilter(); lo.type = 'lowpass';  lo.frequency.value = freqHi;
    const hi  = _ctx.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = freqLo;
    const g   = _ctx.createGain(); const t = _ctx.currentTime;
    g.gain.setValueAtTime(peakGain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(lo); lo.connect(hi); hi.connect(g); g.connect(dst || _sfxGain);
    src.start(); src.stop(t + duration);
  }

  function _canPlay(name) {
    const cd = COOLDOWN[name];
    if (!cd) return true;
    const now = performance.now();
    if ((now - (_lastPlayed[name] || 0)) < cd) return false;
    _lastPlayed[name] = now;
    return true;
  }

  // ─── SFX definitions ──────────────────────────────────────────────────────
  const SFX = {

    place() {
      const t = _ctx.currentTime;
      _osc(120, 'sine',   t, t + 0.18, 0.5);
      _osc(80,  'square', t, t + 0.10, 0.2);
      _noise(0.12, 0.3, 200, 1200);
    },

    sell() {
      const t = _ctx.currentTime;
      [523, 659, 784].forEach((f, i) => _osc(f, 'sine', t + i * 0.07, t + i * 0.07 + 0.2, 0.3));
    },

    arrow() {
      if (!_canPlay('arrow')) return;
      const t = _ctx.currentTime;
      const o = _ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(900, t);
      o.frequency.exponentialRampToValueAtTime(300, t + 0.08);
      const g = _ctx.createGain();
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g); g.connect(_sfxGain); o.start(t); o.stop(t + 0.09);
    },

    cannon() {
      if (!_canPlay('cannon')) return;
      const t = _ctx.currentTime;
      _osc(60,  'sine',   t, t + 0.5,  0.8);
      _osc(40,  'sine',   t, t + 0.4,  0.5);
      _noise(0.25, 0.6, 80, 600);
    },

    sniper() {
      if (!_canPlay('sniper')) return;
      const t = _ctx.currentTime;
      _noise(0.06, 0.9, 3000, 12000);
      _osc(1200, 'sine', t, t + 0.06, 0.3);
    },

    goblinDeath() {
      if (!_canPlay('goblinDeath')) return;
      const t = _ctx.currentTime;
      const o = _ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(600, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.25);
      const g = _ctx.createGain();
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(_sfxGain); o.start(t); o.stop(t + 0.26);
    },

    goblinAttack() {
      if (!_canPlay('goblinAttack')) return;
      const t = _ctx.currentTime;
      _osc(180, 'square', t, t + 0.15, 0.4);
      _noise(0.12, 0.35, 300, 2000);
    },

    castleHit() {
      const t = _ctx.currentTime;
      [220, 277, 330].forEach((f, i) => {
        _osc(f, 'sine', t + i * 0.04, t + i * 0.04 + 0.8, 0.4);
      });
    },

    waveStart() {
      const t = _ctx.currentTime;
      [330, 392, 494, 659].forEach((f, i) => {
        _osc(f, 'square', t + i * 0.12, t + i * 0.12 + 0.2, 0.25);
      });
      _noise(0.15, 0.3, 200, 2000);
    },

    gameOver() {
      const t = _ctx.currentTime;
      [494, 440, 392, 294].forEach((f, i) => {
        _osc(f, 'sawtooth', t + i * 0.22, t + i * 0.22 + 0.35, 0.3);
      });
    },
  };

  // ─── Public ───────────────────────────────────────────────────────────────
  function play(name) {
    if (!_ready || !SFX[name]) return;
    try { SFX[name](); } catch(e) {}
  }

  function setMusicVol(v)  { if (_musicGain) _musicGain.gain.value = Math.max(0, Math.min(1, v)); }
  function setSfxVol(v)    { if (_sfxGain)   _sfxGain.gain.value   = Math.max(0, Math.min(1, v)); }

  return { init, play, setMusicVol, setSfxVol };
})();
