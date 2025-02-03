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
  userId: string;  // Required for user identification
  isPinned?: boolean;  // Add pinned status
  attachments?: Attachment[];
}

const DB_NAME = 'MinNotesDB';
const DB_VERSION = 2;
const STORE_NAME = 'notes';

let db: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      } else {
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (transaction) {
          const store = transaction.objectStore(STORE_NAME);
          if (!store.indexNames.contains('userId')) {
            store.createIndex('userId', 'userId', { unique: false });
          }
        }
      }
    };
  });
};

export const saveNotes = async (notes: Note[], userId: string): Promise<void> => {
  if (!userId) {
    throw new Error('User ID is required to save notes');
  }

  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  const userIndex = store.index('userId');
  const userNotesRequest = userIndex.getAll(userId);
  
  return new Promise((resolve, reject) => {
    userNotesRequest.onsuccess = async () => {
      try {
        const existingNotes = userNotesRequest.result;
        for (const note of existingNotes) {
          await store.delete(note.id);
        }

        for (const note of notes) {
          const noteWithUser = {
            ...note,
            userId,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString()
          };
          store.add(noteWithUser);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    };
    
    userNotesRequest.onerror = () => reject(userNotesRequest.error);
  });
};

export const loadNotes = async (userId: string): Promise<Note[]> => {
  if (!userId) {
    return []; 
  }

  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const userIndex = store.index('userId');

  return new Promise((resolve, reject) => {
    const request = userIndex.getAll(userId);
    
    request.onsuccess = () => {
      const notes = request.result.map(note => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt)
      }));
      resolve(notes);
    };
    
    request.onerror = () => reject(request.error);
  });
};