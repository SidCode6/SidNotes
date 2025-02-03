'use client';

import { useState, useEffect } from 'react';
import { initDB, saveNotes, loadNotes, Note, Attachment } from '../db';
import { getCurrentUser, signIn, signUp, signOut, User } from '../auth';

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize theme and check authentication
  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false;
    setIsDark(savedTheme);
    if (savedTheme) {
      document.documentElement.classList.add('dark');
    }

    // Check if user is already authenticated
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        const userNotes = await loadNotes(currentUser.id);
        setNotes(userNotes);
      }
    };
    checkAuth();
  }, []);

  // Save notes with debouncing
  useEffect(() => {
    let saveTimeout: NodeJS.Timeout;

    const saveUserNotes = async () => {
      if (user && notes.length > 0) {
        try {
          setIsSaving(true);
          await saveNotes(notes, user.id);
        } catch (error) {
          console.error('Failed to save notes:', error);
        } finally {
          setIsSaving(false);
        }
      }
    };

    // Debounce save operation
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveUserNotes, 1000);

    return () => clearTimeout(saveTimeout);
  }, [notes, user]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      if (newTheme) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleNewNote = () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      folder: '',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: user.id,
      attachments: [],
    };
    
    setNotes(prevNotes => [newNote, ...prevNotes]);
    setSelectedNote(newNote);
  };

  // Rest of your component code from page.tsx...
  // Copy all the functions and JSX here

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Copy all your JSX from page.tsx */}
    </div>
  );
}
