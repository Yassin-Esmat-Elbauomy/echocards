import { initDB, seedStarterData, getCardsByDeck } from './db.js';
import {
  getMuted,
  setMuted,
  getRate,
  setRate,
  getAutoSpeak,
  setAutoSpeak,
  getVoices,
  getVoiceURI,
  setVoiceURI
} from './tts.js';
import './components/deck-list.js';
import './components/card-editor.js';
import './components/flash-card.js';

const deckListEl = document.getElementById('deckList');
const flashCardEl = document.getElementById('flashCardView');
const cardEditorEl = document.getElementById('cardEditorView');
const activeDeckTitleEl = document.getElementById('activeDeckTitle');
const activeDeckCountEl = document.getElementById('activeDeckCount');

const muteBtn = document.getElementById('muteBtn');
const rateSlider = document.getElementById('rateSlider');
const rateValue = document.getElementById('rateValue');
const autoSpeakToggle = document.getElementById('autoSpeakToggle');
const voiceSelect = document.getElementById('voiceSelect');

const studyModeBtn = document.getElementById('studyModeBtn');
const manageModeBtn = document.getElementById('manageModeBtn');

let currentDeckId = null;

function updateMuteButtonUI(muted) {
  muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound On';
}

async function initTTSControls() {
  updateMuteButtonUI(getMuted());

  const initialRate = getRate();
  rateSlider.value = String(initialRate);
  rateValue.textContent = `${initialRate.toFixed(1)}x`;

  autoSpeakToggle.checked = getAutoSpeak();

  muteBtn.addEventListener('click', () => {
    const nextMuted = setMuted(!getMuted());
    updateMuteButtonUI(nextMuted);
  });

  rateSlider.addEventListener('input', (e) => {
    const updatedRate = setRate(parseFloat(e.target.value));
    rateValue.textContent = `${updatedRate.toFixed(1)}x`;
  });

  autoSpeakToggle.addEventListener('change', (e) => {
    setAutoSpeak(e.target.checked);
  });

  const voices = await getVoices();
  const savedVoice = getVoiceURI();
  voiceSelect.innerHTML = '<option value="">Default Voice</option>';

  voices.forEach((voice) => {
    const opt = document.createElement('option');
    opt.value = voice.voiceURI;
    opt.textContent = `${voice.name} (${voice.lang})`;
    if (voice.voiceURI === savedVoice) {
      opt.selected = true;
    }
    voiceSelect.appendChild(opt);
  });

  voiceSelect.addEventListener('change', (e) => {
    setVoiceURI(e.target.value);
  });
}

function setViewMode(mode) {
  const isStudy = mode === 'study';
  studyModeBtn.classList.toggle('active', isStudy);
  manageModeBtn.classList.toggle('active', !isStudy);

  flashCardEl.classList.toggle('hidden', !isStudy);
  cardEditorEl.classList.toggle('hidden', isStudy);
}

async function refreshBannerCount(deckId) {
  if (!deckId) {
    activeDeckCountEl.textContent = '0 cards';
    return;
  }
  const cards = await getCardsByDeck(deckId);
  activeDeckCountEl.textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;
}

async function bootstrap() {
  await initDB();
  await seedStarterData();
  await initTTSControls();

  studyModeBtn.addEventListener('click', () => setViewMode('study'));
  manageModeBtn.addEventListener('click', () => setViewMode('manage'));

  document.addEventListener('deck-selected', async (event) => {
    const { deckId, deckName } = event.detail;
    currentDeckId = deckId;
    activeDeckTitleEl.textContent = deckName || 'No deck selected';

    await refreshBannerCount(deckId);
    await flashCardEl.setDeck(deckId);
    await cardEditorEl.setDeck(deckId);
  });

  document.addEventListener('cards-updated', async (event) => {
    const silent = event.detail && event.detail.silentRefresh;
    await refreshBannerCount(currentDeckId);
    await deckListEl.refreshDecks(currentDeckId);

    if (!silent) {
      await flashCardEl.loadCards();
    }
  });

  await deckListEl.refreshDecks();
}

bootstrap();
