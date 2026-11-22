const DB_NAME = 'EchoCardsDB';
const DB_VERSION = 1;

let dbInstance = null;

export function initDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('decks')) {
        db.createObjectStore('decks', {
          keyPath: 'id',
          autoIncrement: true
        });
      }

      if (!db.objectStoreNames.contains('cards')) {
        const cardStore = db.createObjectStore('cards', {
          keyPath: 'id',
          autoIncrement: true
        });
        cardStore.createIndex('by_deckId', 'deckId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error('Failed to open EchoCardsDB'));
    };
  });
}

export async function addDeck(name, description = '') {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['decks'], 'readwrite');
    const store = tx.objectStore('decks');

    const newDeck = {
      name: String(name).trim(),
      description: String(description).trim(),
      createdAt: new Date().toISOString()
    };

    const req = store.add(newDeck);
    req.onsuccess = (event) => {
      resolve({ ...newDeck, id: event.target.result });
    };
    req.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function getDecks() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['decks'], 'readonly');
    const store = tx.objectStore('decks');
    const req = store.getAll();

    req.onsuccess = (event) => {
      resolve(event.target.result || []);
    };
    req.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function deleteDeck(deckId) {
  const db = await initDB();
  const numericDeckId = Number(deckId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['decks', 'cards'], 'readwrite');
    const deckStore = tx.objectStore('decks');
    const cardStore = tx.objectStore('cards');
    const index = cardStore.index('by_deckId');

    deckStore.delete(numericDeckId);

    const cursorReq = index.openCursor(IDBKeyRange.only(numericDeckId));
    cursorReq.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(true);
    tx.onerror = (event) => reject(event.target.error);
  });
}

export async function addCard(deckId, front, back) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards'], 'readwrite');
    const store = tx.objectStore('cards');

    const newCard = {
      deckId: Number(deckId),
      front: String(front).trim(),
      back: String(back).trim(),
      mastery: 0,
      lastReviewed: null
    };

    const req = store.add(newCard);
    req.onsuccess = (event) => {
      resolve({ ...newCard, id: event.target.result });
    };
    req.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function getCardsByDeck(deckId) {
  const db = await initDB();
  const numericDeckId = Number(deckId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards'], 'readonly');
    const store = tx.objectStore('cards');
    const index = store.index('by_deckId');
    const req = index.getAll(IDBKeyRange.only(numericDeckId));

    req.onsuccess = (event) => {
      resolve(event.target.result || []);
    };
    req.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function updateCard(card) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards'], 'readwrite');
    const store = tx.objectStore('cards');

    const updated = {
      id: Number(card.id),
      deckId: Number(card.deckId),
      front: String(card.front).trim(),
      back: String(card.back).trim(),
      mastery: typeof card.mastery === 'number' ? card.mastery : 0,
      lastReviewed: card.lastReviewed || null
    };

    const req = store.put(updated);
    req.onsuccess = () => resolve(updated);
    req.onerror = (event) => reject(event.target.error);
  });
}

export async function deleteCard(cardId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards'], 'readwrite');
    const store = tx.objectStore('cards');
    const req = store.delete(Number(cardId));

    req.onsuccess = () => resolve(true);
    req.onerror = (event) => reject(event.target.error);
  });
}

export async function seedStarterData() {
  const existingDecks = await getDecks();
  if (existingDecks.length > 0) {
    return;
  }

  const starterDeck = await addDeck(
    'Web APIs & JavaScript',
    'Core browser APIs including Web Components, Shadow DOM, IndexedDB, and Speech Synthesis.'
  );

  const sampleCards = [
    {
      front: 'What does customElements.define(name, constructor) do?',
      back: 'It registers a new custom HTML element with the browser so it can be used like a standard tag.'
    },
    {
      front: 'Why must custom element tag names contain a hyphen (-)?',
      back: 'The HTML specification requires a hyphen so custom elements never collide with future built-in HTML tags.'
    },
    {
      front: 'What is the purpose of this.attachShadow({ mode: "open" })?',
      back: 'It attaches an encapsulated Shadow DOM tree to the element so its styles and markup stay isolated from the rest of the page.'
    },
    {
      front: 'Which event in IndexedDB is used to create object stores and indexes?',
      back: 'The onupgradeneeded event on the IDBOpenDBRequest object when opening a new database version.'
    },
    {
      front: 'How do you query cards for a single deck in IndexedDB without scanning every record?',
      back: 'Create an index on deckId and call index.getAll(IDBKeyRange.only(deckId)).'
    },
    {
      front: 'Which browser API converts text strings into spoken audio offline?',
      back: 'window.speechSynthesis paired with a SpeechSynthesisUtterance instance.'
    }
  ];

  for (const item of sampleCards) {
    await addCard(starterDeck.id, item.front, item.back);
  }
}
