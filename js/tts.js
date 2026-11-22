const STORAGE_KEY = 'echocards_tts_prefs';

let isMuted = false;
let rate = 1.0;
let selectedVoiceURI = '';
let autoSpeak = false;
let cachedVoices = [];

function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.isMuted === 'boolean') isMuted = parsed.isMuted;
    if (typeof parsed.rate === 'number') rate = parsed.rate;
    if (typeof parsed.selectedVoiceURI === 'string') selectedVoiceURI = parsed.selectedVoiceURI;
    if (typeof parsed.autoSpeak === 'boolean') autoSpeak = parsed.autoSpeak;
  } catch (err) {
    console.warn('Could not load TTS settings from localStorage', err);
  }
}

function savePrefs() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ isMuted, rate, selectedVoiceURI, autoSpeak })
    );
  } catch (err) {
    console.warn('Could not save TTS settings', err);
  }
}

loadPrefs();

export function getVoices() {
  if (!('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  const current = window.speechSynthesis.getVoices();
  if (current && current.length > 0) {
    cachedVoices = current;
    return Promise.resolve(cachedVoices);
  }

  return new Promise((resolve) => {
    const handleVoicesChanged = () => {
      cachedVoices = window.speechSynthesis.getVoices() || [];
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(cachedVoices);
    };

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices() || [];
      resolve(cachedVoices);
    }, 600);
  });
}

export function stop() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speak(text, { interrupt = true } = {}) {
  if (isMuted || !('speechSynthesis' in window)) {
    return;
  }

  const cleaned = String(text || '').trim();
  if (!cleaned) {
    return;
  }

  if (interrupt) {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.rate = Math.min(2.0, Math.max(0.5, Number(rate) || 1.0));

  const voices = window.speechSynthesis.getVoices();
  if (selectedVoiceURI && voices.length > 0) {
    const matched = voices.find((v) => v.voiceURI === selectedVoiceURI);
    if (matched) {
      utterance.voice = matched;
    }
  }

  window.speechSynthesis.speak(utterance);
}

export function setMuted(muted) {
  isMuted = Boolean(muted);
  if (isMuted) {
    stop();
  }
  savePrefs();
  return isMuted;
}

export function getMuted() {
  return isMuted;
}

export function setRate(newRate) {
  const num = Number(newRate);
  if (!Number.isNaN(num)) {
    rate = Math.min(2.0, Math.max(0.5, num));
    savePrefs();
  }
  return rate;
}

export function getRate() {
  return rate;
}

export function setVoiceURI(voiceURI) {
  selectedVoiceURI = String(voiceURI || '');
  savePrefs();
  return selectedVoiceURI;
}

export function getVoiceURI() {
  return selectedVoiceURI;
}

export function setAutoSpeak(enabled) {
  autoSpeak = Boolean(enabled);
  savePrefs();
  return autoSpeak;
}

export function getAutoSpeak() {
  return autoSpeak;
}
