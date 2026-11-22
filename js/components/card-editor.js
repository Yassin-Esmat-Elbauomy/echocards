import { getCardsByDeck, addCard, updateCard, deleteCard } from '../db.js';
import { speak } from '../tts.js';

class CardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.deckId = null;
    this.cards = [];
    this.editingCardId = null;
  }

  connectedCallback() {
    this.render();
  }

  async setDeck(deckId) {
    this.deckId = deckId ? Number(deckId) : null;
    this.editingCardId = null;
    await this.loadCards();
  }

  async loadCards() {
    if (!this.deckId) {
      this.cards = [];
      this.render();
      return;
    }

    this.cards = await getCardsByDeck(this.deckId);
    this.render();
  }

  emitCardsUpdated() {
    this.dispatchEvent(
      new CustomEvent('cards-updated', {
        bubbles: true,
        composed: true,
        detail: { deckId: this.deckId }
      })
    );
  }

  async handleAddCard(event) {
    event.preventDefault();
    if (!this.deckId) return;

    const frontEl = this.shadowRoot.querySelector('#frontInput');
    const backEl = this.shadowRoot.querySelector('#backInput');
    const front = frontEl.value.trim();
    const back = backEl.value.trim();

    if (!front || !back) return;

    await addCard(this.deckId, front, back);
    frontEl.value = '';
    backEl.value = '';

    speak('Card added');
    await this.loadCards();
    this.emitCardsUpdated();
  }

  startEdit(cardId) {
    this.editingCardId = Number(cardId);
    this.render();
  }

  cancelEdit() {
    this.editingCardId = null;
    this.render();
  }

  async saveEdit(card) {
    const frontEl = this.shadowRoot.querySelector(`#edit-front-${card.id}`);
    const backEl = this.shadowRoot.querySelector(`#edit-back-${card.id}`);
    if (!frontEl || !backEl) return;

    const front = frontEl.value.trim();
    const back = backEl.value.trim();
    if (!front || !back) return;

    await updateCard({
      ...card,
      front,
      back
    });

    this.editingCardId = null;
    await this.loadCards();
    this.emitCardsUpdated();
  }

  async handleDeleteCard(cardId) {
    await deleteCard(cardId);
    speak('Card deleted');
    await this.loadCards();
    this.emitCardsUpdated();
  }

  render() {
    if (!this.deckId) {
      this.shadowRoot.innerHTML = `
        <style>
          .empty-box {
            background: #ffffff;
            border: 1px solid #dce2ee;
            border-radius: 10px;
            padding: 28px;
            text-align: center;
            color: #647087;
          }
        </style>
        <div class="empty-box">Select or create a deck to manage flashcards.</div>
      `;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .editor-wrap {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .card-box {
          background: #ffffff;
          border: 1px solid #dce2ee;
          border-radius: 10px;
          padding: 18px;
        }
        h3 {
          margin: 0 0 12px;
          font-size: 1rem;
          color: #1e2433;
        }
        form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #647087;
        }
        textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 78px;
          padding: 9px 11px;
          border-radius: 8px;
          border: 1px solid #dce2ee;
          font-family: inherit;
          font-size: 0.88rem;
          resize: vertical;
        }
        .form-actions {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-end;
        }
        .btn {
          padding: 8px 14px;
          border-radius: 7px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
        }
        .btn-primary {
          background: #3b5bdb;
          color: #ffffff;
        }
        .btn-primary:hover {
          background: #2f4ac0;
        }
        .btn-ghost {
          background: #f4f6fb;
          border-color: #dce2ee;
          color: #1e2433;
        }
        .btn-danger {
          background: #fff5f5;
          border-color: #ffc9c9;
          color: #e03131;
        }
        .cards-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .card-row {
          border: 1px solid #dce2ee;
          border-radius: 8px;
          padding: 12px 14px;
          background: #f9fafc;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .card-sides {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .side-label {
          font-size: 0.72rem;
          text-transform: uppercase;
          color: #647087;
          font-weight: 600;
          margin-bottom: 3px;
        }
        .side-text {
          font-size: 0.9rem;
          color: #1e2433;
          margin: 0;
          word-break: break-word;
        }
        .row-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .empty-msg {
          color: #647087;
          font-size: 0.9rem;
          margin: 0;
        }
        @media (max-width: 640px) {
          form, .card-sides {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="editor-wrap">
        <div class="card-box">
          <h3>Add New Flashcard</h3>
          <form id="addCardForm">
            <div class="field">
              <label for="frontInput">Front (Prompt / Question)</label>
              <textarea id="frontInput" placeholder="Enter question or term..." required></textarea>
            </div>
            <div class="field">
              <label for="backInput">Back (Answer / Explanation)</label>
              <textarea id="backInput" placeholder="Enter answer or definition..." required></textarea>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit">+ Add Card</button>
            </div>
          </form>
        </div>

        <div class="card-box">
          <h3>Cards in Deck (${this.cards.length})</h3>
          ${
            this.cards.length === 0
              ? `<p class="empty-msg">No cards in this deck yet. Add your first flashcard above.</p>`
              : `<div class="cards-list">
                  ${this.cards
                    .map((card) =>
                      this.editingCardId === card.id
                        ? `
                      <div class="card-row">
                        <div class="card-sides">
                          <div class="field">
                            <label>Front</label>
                            <textarea id="edit-front-${card.id}">${this.escapeHTML(card.front)}</textarea>
                          </div>
                          <div class="field">
                            <label>Back</label>
                            <textarea id="edit-back-${card.id}">${this.escapeHTML(card.back)}</textarea>
                          </div>
                        </div>
                        <div class="row-actions">
                          <button class="btn btn-ghost" type="button" data-cancel-id="${card.id}">Cancel</button>
                          <button class="btn btn-primary" type="button" data-save-id="${card.id}">Save Changes</button>
                        </div>
                      </div>
                    `
                        : `
                      <div class="card-row">
                        <div class="card-sides">
                          <div>
                            <div class="side-label">Front</div>
                            <p class="side-text">${this.escapeHTML(card.front)}</p>
                          </div>
                          <div>
                            <div class="side-label">Back</div>
                            <p class="side-text">${this.escapeHTML(card.back)}</p>
                          </div>
                        </div>
                        <div class="row-actions">
                          <button class="btn btn-ghost" type="button" data-edit-id="${card.id}">Edit</button>
                          <button class="btn btn-danger" type="button" data-del-id="${card.id}">Delete</button>
                        </div>
                      </div>
                    `
                    )
                    .join('')}
                </div>`
          }
        </div>
      </div>
    `;

    const addForm = this.shadowRoot.querySelector('#addCardForm');
    if (addForm) {
      addForm.addEventListener('submit', (e) => this.handleAddCard(e));
    }

    this.shadowRoot.querySelectorAll('[data-edit-id]').forEach((btn) => {
      btn.addEventListener('click', () => this.startEdit(btn.getAttribute('data-edit-id')));
    });

    this.shadowRoot.querySelectorAll('[data-cancel-id]').forEach((btn) => {
      btn.addEventListener('click', () => this.cancelEdit());
    });

    this.shadowRoot.querySelectorAll('[data-save-id]').forEach((btn) => {
      const id = Number(btn.getAttribute('data-save-id'));
      const card = this.cards.find((c) => c.id === id);
      if (card) {
        btn.addEventListener('click', () => this.saveEdit(card));
      }
    });

    this.shadowRoot.querySelectorAll('[data-del-id]').forEach((btn) => {
      const id = Number(btn.getAttribute('data-del-id'));
      btn.addEventListener('click', () => this.handleDeleteCard(id));
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

customElements.define('card-editor', CardEditor);
