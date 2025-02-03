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

  // Initialize theme
  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false;
    setIsDark(savedTheme);
    if (savedTheme) {
      document.documentElement.classList.add('dark');
    }
  }, []);

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

  // Initialize database and load user
  useEffect(() => {
    const init = async () => {
      try {
        await initDB();
        const currentUser = getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          const userNotes = await loadNotes(currentUser.id);
          setNotes(userNotes);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();
  }, []);

  const handleNewNote = async () => {
    if (!user?.id) return;

    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      folder: 'Personal',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: user.id,
      isPinned: false,
      attachments: []
    };
    
    try {
      setNotes([newNote, ...notes]);
      setSelectedNote(newNote);
      await saveNotes([newNote, ...notes], user.id);
    } catch (error) {
      console.error('Failed to create note:', error);
      // Revert changes if save failed
      setNotes(notes);
      setSelectedNote(null);
    }
  };

  // Rest of your component code from page.tsx...
  // Copy all the functions and JSX here

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Copy all your JSX from page.tsx */}
    </div>
  );
}
