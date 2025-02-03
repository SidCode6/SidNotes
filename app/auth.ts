export interface User {
  id: string;
  email: string;
}

const AUTH_STORE = 'users';
const AUTH_KEY = 'minnotes_auth';
const DB_VERSION = 1;
const DB_NAME = 'MinNotesAuthDB';

let db: IDBDatabase | null = null;

// Add crypto utilities for password hashing
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const generateSecureId = (): string => {
  return crypto.randomUUID();
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

export const initAuthDB = (): Promise<IDBDatabase> => {
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
      
      if (!database.objectStoreNames.contains(AUTH_STORE)) {
        const store = database.createObjectStore(AUTH_STORE, { keyPath: 'email' });
        store.createIndex('email', 'email', { unique: true });
      }
    };
  });
};

export const signUp = async (email: string, password: string): Promise<User> => {
  if (!validateEmail(email)) {
    throw new Error('Invalid email format');
  }
  if (!validatePassword(password)) {
    throw new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number');
  }

  // Hash password before starting transaction
  const hashedPassword = await hashPassword(password);
  const user: User = { id: generateSecureId(), email };

  const db = await initAuthDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_STORE, 'readwrite');
    const store = tx.objectStore(AUTH_STORE);

    // First check if user exists
    const getRequest = store.get(email);
    
    getRequest.onsuccess = () => {
      if (getRequest.result) {
        reject(new Error('Email already exists'));
        return;
      }

      // User doesn't exist, proceed with adding
      const addRequest = store.add({ ...user, password: hashedPassword });
      
      addRequest.onsuccess = () => {
        const session = {
          user,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        resolve(user);
      };

      addRequest.onerror = () => {
        reject(new Error('Failed to create account'));
      };
    };

    getRequest.onerror = () => {
      reject(new Error('Failed to check existing user'));
    };

    tx.onerror = () => {
      reject(new Error('Transaction failed'));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
};

export const signIn = async (email: string, password: string): Promise<User> => {
  if (!validateEmail(email)) {
    throw new Error('Invalid email format');
  }

  // Hash password before starting transaction
  const hashedPassword = await hashPassword(password);
  const db = await initAuthDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTH_STORE, 'readonly');
    const store = tx.objectStore(AUTH_STORE);

    const request = store.get(email);

    request.onsuccess = () => {
      const user = request.result;
      if (!user) {
        reject(new Error('User not found'));
        return;
      }

      if (user.password !== hashedPassword) {
        reject(new Error('Invalid password'));
        return;
      }

      const userData: User = { id: user.id, email: user.email };
      const session = {
        user: userData,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      };
      localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      resolve(userData);
    };

    request.onerror = () => {
      reject(new Error('Authentication failed'));
    };

    tx.onerror = () => {
      reject(new Error('Transaction failed'));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
};

export const getCurrentUser = (): User | null => {
  const auth = localStorage.getItem(AUTH_KEY);
  if (!auth) return null;
  
  const session = JSON.parse(auth);
  if (Date.now() > session.expiresAt) {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
  
  return session.user;
};

export const signOut = () => {
  localStorage.removeItem(AUTH_KEY);
};