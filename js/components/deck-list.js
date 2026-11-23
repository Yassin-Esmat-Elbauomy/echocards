import { getDecks, addDeck, deleteDeck, getCardsByDeck } from '../db.js';
import { speak } from '../tts.js';

class DeckList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.decks = [];
    this.selectedDeckId = null;
  }

  connectedCallback() {
    this.render();
  }

  async refreshDecks(preferredDeckId = null) {
    const rawDecks = await getDecks();
    const enriched = [];

    for (const d of rawDecks) {
      const cards = await getCardsByDeck(d.id);
      enriched.push({
        ...d,
        cardCount: cards.length
      });
    }

    this.decks = enriched;

    if (preferredDeckId !== null && this.decks.some((d) => d.id === Number(preferredDeckId))) {
      this.selectedDeckId = Number(preferredDeckId);
    } else if (this.selectedDeckId !== null && this.decks.some((d) => d.id === this.selectedDeckId)) {
      // keep current selection
    } else if (this.decks.length > 0) {
      this.selectedDeckId = this.decks[0].id;
    } else {
      this.selectedDeckId = null;
    }

    this.render();
    this.notifySelectedDeck();
  }

  notifySelectedDeck() {
    const current = this.decks.find((d) => d.id === this.selectedDeckId) || null;
    this.dispatchEvent(
      new CustomEvent('deck-selected', {
        bubbles: true,
        composed: true,
        detail: {
          deckId: current ? current.id : null,
          deckName: current ? current.name : '',
          cardCount: current ? current.cardCount : 0
        }
      })
    );
  }

  async handleCreateDeck(event) {
    event.preventDefault();
    const nameInput = this.shadowRoot.querySelector('#deckNameInput');
    const descInput = this.shadowRoot.querySelector('#deckDescInput');

    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
      return;
    }

    const created = await addDeck(name, description);
    nameInput.value = '';
    descInput.value = '';

    speak(`Deck created: ${created.name}`);
    await this.refreshDecks(created.id);
  }

  async handleDeleteDeck(event, deck) {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete deck "${deck.name}" and all ${deck.cardCount} cards inside it?`
    );
    if (!confirmed) {
      return;
    }

    await deleteDeck(deck.id);
    speak(`Deck deleted: ${deck.name}`);
    await this.refreshDecks();
  }

  handleSelectDeck(deck) {
    if (this.selectedDeckId === deck.id) {
      return;
    }
    this.selectedDeckId = deck.id;
    this.render();
    this.notifySelectedDeck();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .panel {
          background: #ffffff;
          border: 1px solid #dce2ee;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        h3 {
          margin: 0;
          font-size: 1rem;
          color: #1e2433;
        }
        .deck-items {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 360px;
          overflow-y: auto;
        }
        .deck-item {
          border: 1px solid #dce2ee;
          border-radius: 8px;
          padding: 10px 12px;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          background: #f9fafc;
          transition: border-color 0.15s, background 0.15s;
        }
        .deck-item:hover {
          border-color: #3b5bdb;
        }
        .deck-item.active {
          border-color: #3b5bdb;
          background: #edf2ff;
        }
        .deck-info {
          min-width: 0;
          flex: 1;
        }
        .deck-title {
          font-weight: 600;
          font-size: 0.94rem;
          color: #1e2433;
          margin: 0 0 3px;
          word-break: break-word;
        }
        .deck-desc {
          font-size: 0.78rem;
          color: #647087;
          margin: 0 0 6px;
          word-break: break-word;
        }
        .deck-badge {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 600;
          color: #3b5bdb;
          background: #dbe4ff;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .delete-btn {
          border: 1px solid transparent;
          background: transparent;
          color: #e03131;
          font-size: 0.8rem;
          padding: 4px 7px;
          border-radius: 6px;
          cursor: pointer;
        }
        .delete-btn:hover {
          background: #ffe3e3;
        }
        .empty-note {
          font-size: 0.85rem;
          color: #647087;
          margin: 0;
          text-align: center;
          padding: 12px 0;
        }
        form {
          border-top: 1px solid #dce2ee;
          padding-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .form-title {
          font-size: 0.88rem;
          font-weight: 600;
          margin: 0;
        }
        input, textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border-radius: 7px;
          border: 1px solid #dce2ee;
          font-family: inherit;
          font-size: 0.85rem;
        }
        textarea {
          resize: vertical;
          min-height: 54px;
        }
        .submit-btn {
          background: #3b5bdb;
          color: #ffffff;
          border: none;
          border-radius: 7px;
          padding: 9px 12px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .submit-btn:hover {
          background: #2f4ac0;
        }
      </style>

      <div class="panel">
        <h3>Study Decks</h3>

        ${
          this.decks.length === 0
            ? `<p class="empty-note">No decks yet. Create one below!</p>`
            : `<ul class="deck-items">
                ${this.decks
                  .map(
                    (deck) => `
                  <li class="deck-item ${deck.id === this.selectedDeckId ? 'active' : ''}" data-id="${deck.id}">
                    <div class="deck-info">
                      <p class="deck-title">${this.escapeHTML(deck.name)}</p>
                      ${
                        deck.description
                          ? `<p class="deck-desc">${this.escapeHTML(deck.description)}</p>`
                          : ''
                      }
                      <span class="deck-badge">${deck.cardCount} ${
                      deck.cardCount === 1 ? 'card' : 'cards'
                    }</span>
                    </div>
                    <button class="delete-btn" type="button" data-delete-id="${deck.id}" title="Delete deck">
                      Delete
                    </button>
                  </li>
                `
                  )
                  .join('')}
              </ul>`
        }

        <form id="createDeckForm">
          <p class="form-title">Create New Deck</p>
          <input id="deckNameInput" type="text" placeholder="Deck name (e.g. Biology 101)" required />
          <textarea id="deckDescInput" placeholder="Short description (optional)"></textarea>
          <button class="submit-btn" type="submit">+ Create Deck</button>
        </form>
      </div>
    `;

    const form = this.shadowRoot.querySelector('#createDeckForm');
    form.addEventListener('submit', (e) => this.handleCreateDeck(e));

    this.shadowRoot.querySelectorAll('.deck-item').forEach((itemEl) => {
      const id = Number(itemEl.getAttribute('data-id'));
      const deck = this.decks.find((d) => d.id === id);
      if (!deck) return;

      itemEl.addEventListener('click', () => this.handleSelectDeck(deck));
    });

    this.shadowRoot.querySelectorAll('.delete-btn').forEach((btnEl) => {
      const id = Number(btnEl.getAttribute('data-delete-id'));
      const deck = this.decks.find((d) => d.id === id);
      if (!deck) return;

      btnEl.addEventListener('click', (e) => this.handleDeleteDeck(e, deck));
    });
  }

  escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

customElements.define('deck-list', DeckList);
