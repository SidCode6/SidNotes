'use client';

import { useState, useEffect } from 'react';
import { initDB, saveNotes, loadNotes, Note, Attachment } from './db';
import { getCurrentUser, signIn, signUp, signOut, User } from './auth';

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [folders] = useState<string[]>(['Personal', 'Work', 'Ideas']);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

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

  const exportNotes = () => {
    const notesToExport = selectedFolder 
      ? notes.filter(note => note.folder === selectedFolder)
      : notes;
    
    const dataStr = JSON.stringify(notesToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `minnotes-export-${new Date().toLocaleDateString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedNote || !user?.id || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      const newAttachment: Attachment = {
        id: crypto.randomUUID(),
        type: file.type.startsWith('image/') ? 'image' : 'pdf',
        name: file.name,
        data: base64Data,
        createdAt: new Date()
      };

      const updatedNote = {
        ...selectedNote,
        attachments: [...(selectedNote.attachments || []), newAttachment],
        updatedAt: new Date()
      };

      setSelectedNote(updatedNote);
      const updatedNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
      setNotes(updatedNotes);
      await saveNotes(updatedNotes, user.id);
    };

    reader.readAsDataURL(file);
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!selectedNote || !user?.id) return;

    const updatedNote = {
      ...selectedNote,
      attachments: selectedNote.attachments?.filter(a => a.id !== attachmentId) || [],
      updatedAt: new Date()
    };

    setSelectedNote(updatedNote);
    const updatedNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
    setNotes(updatedNotes);
    await saveNotes(updatedNotes, user.id);
  };

  const downloadAttachment = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load notes when user changes
  useEffect(() => {
    const loadNotesForUser = async () => {
      try {
        if (user?.id) {
          const storedNotes = await loadNotes(user.id);
          setNotes(storedNotes);
        } else {
          // Clear notes when no user is logged in
          setNotes([]);
          setSelectedNote(null);
        }
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };

    loadNotesForUser();
  }, [user?.id]);

  useEffect(() => {
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false;
    setIsDark(savedTheme);
    if (savedTheme) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (selectedNote && user?.id) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      setIsSaving(true);
      const timer = setTimeout(() => {
        updateNote(selectedNote);
      }, 1000);
      setAutoSaveTimer(timer);
    }
  }, [selectedNote, user?.id]);

  const updateNote = async (note: Note) => {
    if (!user?.id) return;
    
    const updatedNotes = notes.map(n => 
      n.id === note.id ? { ...note, updatedAt: new Date() } : n
    );
    setNotes(updatedNotes);
    try {
      await saveNotes(updatedNotes, user.id);
      setIsSaving(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      setIsSaving(false);
    }
  };

  const createNote = () => {
    if (!user?.id) {
      setShowAuth(true);
      return;
    }

    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      folder: selectedFolder || 'Personal',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: user.id,
      isPinned: false,
      attachments: []
    };
    
    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
  };

  const deleteNote = async (noteId: string) => {
    if (!user?.id) return;
    
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    if (selectedNote?.id === noteId) {
      setSelectedNote(updatedNotes[0] || null);
    }
    try {
      await saveNotes(updatedNotes, user.id);
    } catch (error) {
      console.error('Error saving notes after deletion:', error);
    }
  };

  const togglePin = async (noteId: string) => {
    if (!user?.id) return;
    
    const updatedNotes = notes.map(note => 
      note.id === noteId ? { ...note, isPinned: !note.isPinned } : note
    );
    setNotes(updatedNotes);
    try {
      await saveNotes(updatedNotes, user.id);
    } catch (error) {
      console.error('Error saving pinned note:', error);
    }
  };

  const handleSignOut = () => {
    signOut();
    setUser(null);
    setNotes([]);
    setSelectedNote(null);
    setShowAuth(false);
  };

  // Authentication handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const authUser = await (authMode === 'signin' ? signIn(email, password) : signUp(email, password));
      setUser(authUser);
      setShowAuth(false);
      setEmail('');
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    }
  };

  // Helper functions
  const getFolderNoteCount = (folderName: string) => {
    return notes.filter(note => note.folder === folderName).length;
  };

  const getWordCount = (text: string): number => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const getCharacterCount = (text: string): number => {
    return text.length;
  };

  const filteredNotes = notes
    .filter((note) => !selectedFolder || note.folder === selectedFolder)
    .filter((note) => 
      searchQuery === '' || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const sortedNotes = filteredNotes
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium dark:text-white">{previewAttachment.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadAttachment(previewAttachment)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Download"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewAttachment.type === 'image' ? (
                <img
                  src={previewAttachment.data}
                  alt={previewAttachment.name}
                  className="max-w-full h-auto mx-auto"
                />
              ) : (
                <iframe
                  src={previewAttachment.data}
                  className="w-full h-full min-h-[70vh] border-0"
                  title={previewAttachment.name}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-16'} flex flex-col bg-gray-100 dark:bg-gray-800 overflow-y-auto border-r border-gray-200 dark:border-gray-700 transition-all duration-200`}>
        <div className={`flex items-center justify-between p-4 ${!isSidebarOpen && 'justify-center'}`}>
          {isSidebarOpen ? (
            <>
              <h1 className="text-2xl font-bold dark:text-white">Notes</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => user ? handleSignOut() : setShowAuth(true)}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white"
                  title={user ? 'Sign Out' : 'Sign In'}
                >
                  {user ? '👤' : '🔑'}
                </button>
                <button
                  onClick={exportNotes}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white"
                  title="Export Notes (JSON)"
                >
                  📤
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white"
                  title={isDark ? 'Light Mode' : 'Dark Mode'}
                >
                  {isDark ? '🌞' : '🌙'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white"
                title="Expand Sidebar"
              >
                ▶
              </button>
              <button
                onClick={() => user ? handleSignOut() : setShowAuth(true)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white"
                title={user ? 'Sign Out' : 'Sign In'}
              >
                {user ? '👤' : '🔑'}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white"
                title={isDark ? 'Light Mode' : 'Dark Mode'}
              >
                {isDark ? '🌞' : '🌙'}
              </button>
            </div>
          )}
        </div>

        {isSidebarOpen ? (
          <>
            <button 
              onClick={createNote}
              className="mx-4 mb-6 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              New Note
            </button>

            <div className="relative mx-4 mb-6">
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="mx-4 mb-6">
              <h2 className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-400">
                FOLDERS
              </h2>
              <div className="space-y-1">
                {folders.map((folder) => (
                  <button
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex justify-between items-center ${
                      selectedFolder === folder
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white'
                    }`}
                  >
                    <span>📁 {folder}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {getFolderNoteCount(folder)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mx-4">
              <h2 className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-400">
                NOTES
              </h2>
              <div className="space-y-2">
                {sortedNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`group relative p-3 rounded-lg cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 ${
                      selectedNote?.id === note.id
                        ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div onClick={() => setSelectedNote(note)}>
                      <div className="flex items-center gap-2">
                        {note.isPinned && <span title="Pinned" className="text-yellow-500">📌</span>}
                        <span className="text-sm text-gray-500">📝</span>
                        <h3 className="font-medium truncate dark:text-white">{note.title}</h3>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate ml-6">
                        {note.content || 'No content'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-6">
                        {new Date(note.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                      <button
                        onClick={() => togglePin(note.id)}
                        className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        title={note.isPinned ? "Unpin" : "Pin"}
                      >
                        {note.isPinned ? "📌" : "📍"}
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 mt-4">
            <button
              onClick={createNote}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-white"
              title="New Note"
            >
              📝
            </button>
          </div>
        )}
      </aside>

      {/* Toggle button for expanded sidebar */}
      {isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="absolute left-64 top-4 p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-r-lg border-r border-t border-b border-gray-200 dark:border-gray-700"
          title="Collapse Sidebar"
        >
          ◀
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 bg-white dark:bg-gray-900 overflow-y-auto">
        {selectedNote ? (
          <div className="h-full flex flex-col">
            <input
              type="text"
              value={selectedNote.title}
              onChange={(e) => {
                setSelectedNote({...selectedNote, title: e.target.value});
              }}
              className="text-2xl font-bold bg-transparent border-none outline-none mb-4 dark:text-white focus:ring-2 focus:ring-blue-500 rounded"
              placeholder="Note title"
            />

            {/* Attachments Section */}
            {selectedNote.attachments && selectedNote.attachments.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-4">
                {selectedNote.attachments.map(attachment => (
                  <div key={attachment.id} className="relative group">
                    {attachment.type === 'image' ? (
                      <div className="relative cursor-pointer group/preview">
                        <img
                          src={attachment.data}
                          alt={attachment.name}
                          className="max-h-40 rounded border border-gray-200 dark:border-gray-700"
                          onClick={() => setPreviewAttachment(attachment)}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadAttachment(attachment);
                            }}
                            className="p-1 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
                            title="Download"
                          >
                            ⬇️
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-gray-700">
                        <span>📄</span>
                        <span 
                          className="text-sm cursor-pointer hover:text-blue-500"
                          onClick={() => setPreviewAttachment(attachment)}
                        >
                          {attachment.name}
                        </span>
                        <button
                          onClick={() => downloadAttachment(attachment)}
                          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Download"
                        >
                          ⬇️
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={selectedNote.content}
              onChange={(e) => {
                setSelectedNote({...selectedNote, content: e.target.value});
              }}
              className="flex-1 w-full bg-transparent border-none outline-none resize-none dark:text-white focus:ring-2 focus:ring-blue-500 rounded"
              placeholder="Start writing..."
            />
            <div className="flex justify-between items-center mt-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex gap-4">
                <span>Words: {getWordCount(selectedNote.content)}</span>
                <span>Characters: {getCharacterCount(selectedNote.content)}</span>
                <span>Last updated: {new Date(selectedNote.updatedAt).toLocaleString()}</span>
                {isSaving && <span>Saving...</span>}
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleAttachment}
                    className="hidden"
                  />
                  <span title="Add attachment">📎</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <p>Select a note or create a new one</p>
          </div>
        )}
      </main>

      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
            </h2>
            <form onSubmit={handleAuth} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
              <button
                type="submit"
                className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="w-full text-sm text-blue-500 hover:text-blue-600"
              >
                {authMode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
