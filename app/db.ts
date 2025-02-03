export interface Attachment {
  id: string;
  type: 'image' | 'pdf';
  name: string;
  data: string;  // Base64 encoded data
  createdAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  isPinned?: boolean;
  attachments?: Attachment[];
}

const DB_NAME = 'MinNotesDB';
const DB_VERSION = 1;
let db: IDBDatabase | null = null;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Your browser doesn\'t support IndexedDB'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event);
      reject(new Error('Could not open database'));
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains('notes')) {
        const store = database.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
  });
};

export const saveNotes = async (notes: Note[], userId: string): Promise<void> => {
  if (!db) {
    await initDB();
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db!.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const userIndex = store.index('userId');

      // First, delete all existing notes for this user
      const deleteRequest = userIndex.openKeyCursor(userId);
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          // After deletion, add all the new notes
          notes.forEach(note => {
            store.add(note);
          });
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to save notes'));
    } catch (error) {
      reject(error);
    }
  });
};

export const loadNotes = async (userId: string): Promise<Note[]> => {
  if (!db) {
    await initDB();
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db!.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const userIndex = store.index('userId');
      const request = userIndex.getAll(userId);

      request.onsuccess = () => {
        const notes = request.result;
        resolve(notes || []);
      };

      request.onerror = () => reject(new Error('Failed to load notes'));
    } catch (error) {
      reject(error);
    }
  });
};