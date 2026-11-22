import { getCardsByDeck, updateCard } from '../db.js';
import { speak, getAutoSpeak } from '../tts.js';

class FlashCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.deckId = null;
    this.cards = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.reviewedCount = 0;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  connectedCallback() {
    window.addEventListener('keydown', this.handleKeyDown);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  async setDeck(deckId) {
    this.deckId = deckId ? Number(deckId) : null;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.reviewedCount = 0;
    await this.loadCards();
  }

  async loadCards() {
    if (!this.deckId) {
      this.cards = [];
      this.render();
      return;
    }

    this.cards = await getCardsByDeck(this.deckId);
    if (this.currentIndex >= this.cards.length) {
      this.currentIndex = Math.max(0, this.cards.length - 1);
    }
    this.isFlipped = false;
    this.render();

    if (this.cards.length > 0 && getAutoSpeak()) {
      this.speakCurrentSide();
    }
  }

  get currentCard() {
    return this.cards[this.currentIndex] || null;
  }

  handleKeyDown(event) {
    if (this.classList.contains('hidden') || this.cards.length === 0) {
      return;
    }

    const path = event.composedPath ? event.composedPath() : [];
    const isTyping = path.some(
      (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
    );
    if (isTyping) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      this.flipCard();
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      this.speakCurrentSide();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextCard();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prevCard();
    }
  }

  flipCard() {
    if (!this.currentCard) return;
    this.isFlipped = !this.isFlipped;
    const inner = this.shadowRoot.querySelector('.flip-card-inner');
    if (inner) {
      inner.classList.toggle('flipped', this.isFlipped);
    }

    if (getAutoSpeak()) {
      this.speakCurrentSide();
    }
  }

  speakCurrentSide() {
    const card = this.currentCard;
    if (!card) return;
    const textToRead = this.isFlipped ? card.back : card.front;
    speak(textToRead, { interrupt: true });
  }

  prevCard() {
    if (this.cards.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.cards.length) % this.cards.length;
    this.isFlipped = false;
    this.render();

    if (getAutoSpeak()) {
      this.speakCurrentSide();
    }
  }

  nextCard() {
    if (this.cards.length === 0) return;
    const isLastCard = this.currentIndex === this.cards.length - 1;

    if (isLastCard) {
      const totalReviewed = this.reviewedCount > 0 ? this.reviewedCount : this.cards.length;
      speak(`Session complete! You reviewed ${totalReviewed} cards.`);
      this.currentIndex = 0;
      this.reviewedCount = 0;
      this.isFlipped = false;
      this.render();
      return;
    }

    this.currentIndex += 1;
    this.isFlipped = false;
    this.render();

    if (getAutoSpeak()) {
      this.speakCurrentSide();
    }
  }

  shuffleCards() {
    if (this.cards.length <= 1) return;
    const copy = [...this.cards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    this.cards = copy;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.render();

    if (getAutoSpeak()) {
      this.speakCurrentSide();
    }
  }

  async markMastery(level) {
    const card = this.currentCard;
    if (!card) return;

    const updated = await updateCard({
      ...card,
      mastery: level,
      lastReviewed: new Date().toISOString()
    });

    this.cards[this.currentIndex] = updated;
    this.reviewedCount += 1;

    this.dispatchEvent(
      new CustomEvent('cards-updated', {
        bubbles: true,
        composed: true,
        detail: { deckId: this.deckId, silentRefresh: true }
      })
    );

    this.nextCard();
  }

  getMasteryInfo(mastery) {
    if (mastery === 2) return { label: 'Mastered', cls: 'badge-mastered' };
    if (mastery === 1) return { label: 'Learning', cls: 'badge-learning' };
    return { label: 'New', cls: 'badge-new' };
  }

  render() {
    if (!this.deckId || this.cards.length === 0) {
      this.shadowRoot.innerHTML = `
        <style>
          .empty-study {
            background: #ffffff;
            border: 1px solid #dce2ee;
            border-radius: 10px;
            padding: 36px 20px;
            text-align: center;
            color: #647087;
          }
        </style>
        <div class="empty-study">
          <p>No flashcards in this deck yet. Switch to <strong>Manage Cards</strong> to add cards!</p>
        </div>
      `;
      return;
    }

    const card = this.currentCard;
    const total = this.cards.length;
    const currentNum = this.currentIndex + 1;
    const progressPercent = Math.round((currentNum / total) * 100);
    const mastery = this.getMasteryInfo(card.mastery);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .study-box {
          background: #ffffff;
          border: 1px solid #dce2ee;
          border-radius: 10px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .counter {
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e2433;
        }
        .badge {
          font-size: 0.76rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .badge-new {
          background: #edf2ff;
          color: #3b5bdb;
        }
        .badge-learning {
          background: #fff4e6;
          color: #d9480f;
        }
        .badge-mastered {
          background: #ebfbee;
          color: #2b8a3e;
        }
        .progress-track {
          width: 100%;
          height: 8px;
          background: #edf0f7;
          border-radius: 999px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #3b5bdb;
          transition: width 0.2s ease;
        }
        .flip-scene {
          perspective: 1000px;
          width: 100%;
          height: 250px;
          cursor: pointer;
        }
        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
          transform-style: preserve-3d;
        }
        .flip-card-inner.flipped {
          transform: rotateY(180deg);
        }
        .flip-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 12px;
          border: 2px solid #dce2ee;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #f9fafc;
          box-sizing: border-box;
        }
        .flip-face.back {
          transform: rotateY(180deg);
          background: #edf2ff;
          border-color: #bac8ff;
        }
        .face-tag {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #647087;
          font-weight: 700;
        }
        .face-content {
          font-size: 1.22rem;
          font-weight: 600;
          color: #1e2433;
          text-align: center;
          margin: auto 0;
          line-height: 1.45;
          word-break: break-word;
        }
        .face-hint {
          font-size: 0.76rem;
          color: #647087;
          text-align: center;
        }
        .controls-grid {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .btn-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        button {
          padding: 8px 14px;
          border-radius: 7px;
          border: 1px solid #dce2ee;
          background: #ffffff;
          color: #1e2433;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        button:hover {
          border-color: #3b5bdb;
          color: #3b5bdb;
        }
        .btn-speak {
          background: #edf2ff;
          border-color: #bac8ff;
          color: #3b5bdb;
        }
        .btn-again {
          background: #fff4e6;
          border-color: #ffd8a8;
          color: #d9480f;
        }
        .btn-gotit {
          background: #ebfbee;
          border-color: #b2f2bb;
          color: #2b8a3e;
        }
        .shortcuts-hint {
          font-size: 0.76rem;
          color: #647087;
          text-align: center;
          margin: 4px 0 0;
        }
        kbd {
          background: #f4f6fb;
          border: 1px solid #dce2ee;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.73rem;
        }
      </style>

      <div class="study-box">
        <div class="top-row">
          <span class="counter">Card ${currentNum} of ${total}</span>
          <span class="badge ${mastery.cls}">${mastery.label}</span>
        </div>

        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>

        <div class="flip-scene" id="cardSurface" title="Click or press Space to flip">
          <div class="flip-card-inner ${this.isFlipped ? 'flipped' : ''}">
            <div class="flip-face front">
              <span class="face-tag">Front • Question</span>
              <p class="face-content">${this.escapeHTML(card.front)}</p>
              <span class="face-hint">Click card or press Space to flip</span>
            </div>
            <div class="flip-face back">
              <span class="face-tag">Back • Answer</span>
              <p class="face-content">${this.escapeHTML(card.back)}</p>
              <span class="face-hint">Rate your mastery below</span>
            </div>
          </div>
        </div>

        <div class="controls-grid">
          <div class="btn-group">
            <button id="prevBtn" type="button">← Previous</button>
            <button id="flipBtn" type="button">Flip Card</button>
            <button id="speakBtn" class="btn-speak" type="button">🔊 Speak</button>
            <button id="nextBtn" type="button">Next →</button>
            <button id="shuffleBtn" type="button">🔀 Shuffle</button>
          </div>

          <div class="btn-group">
            <button id="againBtn" class="btn-again" type="button">Study Again</button>
            <button id="gotItBtn" class="btn-gotit" type="button">✓ Got It</button>
          </div>
        </div>

        <p class="shortcuts-hint">
          Shortcuts: <kbd>Space</kbd> Flip • <kbd>S</kbd> Speak • <kbd>←</kbd> / <kbd>→</kbd> Navigate
        </p>
      </div>
    `;

    this.shadowRoot.querySelector('#cardSurface').addEventListener('click', () => this.flipCard());
    this.shadowRoot.querySelector('#flipBtn').addEventListener('click', () => this.flipCard());
    this.shadowRoot.querySelector('#speakBtn').addEventListener('click', () => this.speakCurrentSide());
    this.shadowRoot.querySelector('#prevBtn').addEventListener('click', () => this.prevCard());
    this.shadowRoot.querySelector('#nextBtn').addEventListener('click', () => this.nextCard());
    this.shadowRoot.querySelector('#shuffleBtn').addEventListener('click', () => this.shuffleCards());
    this.shadowRoot.querySelector('#againBtn').addEventListener('click', () => this.markMastery(1));
    this.shadowRoot.querySelector('#gotItBtn').addEventListener('click', () => this.markMastery(2));
  }

  escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

customElements.define('flash-card', FlashCard);
