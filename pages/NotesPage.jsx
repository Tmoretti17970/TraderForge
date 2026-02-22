// ═══════════════════════════════════════════════════════════════════
// TradeForge — Notes Page (Redesign)
//
// Trading journal notes with narrative treatment:
//   1. Header with count + New Note CTA
//   2. Search bar (when notes exist)
//   3. Note cards with tags, timestamps, truncated content
//   4. Note form modal
//
// Embedded inside JournalPage as a tab (Sprint 2 IA).
// Mobile-responsive with larger touch targets + font sizes.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, F, M } from '../constants.js';
import { radii } from '../theme/tokens.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { Card, Btn, ModalOverlay, inputStyle } from '../components/UIKit.jsx';
import { NotesEmptyState } from '../components/EmptyState.jsx';
import { uid } from '../utils.js';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import toast from '../components/Toast.jsx';

export default function NotesPage() {
  const notes = useTradeStore((s) => s.notes);
  const addNote = useTradeStore((s) => s.addNote);
  const deleteNote = useTradeStore((s) => s.deleteNote);
  const updateNote = useTradeStore((s) => s.updateNote);
  const { isMobile } = useBreakpoints();

  const [formOpen, setFormOpen] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [filter, setFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filter notes
  const filtered = useMemo(() => {
    if (!filter.trim()) return notes;
    const q = filter.toLowerCase();
    return notes.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, filter]);

  const handleSave = (note) => {
    if (editNote) {
      updateNote(editNote.id, note);
      toast.success('Note updated');
    } else {
      addNote({ ...note, id: uid(), createdAt: new Date().toISOString() });
      toast.success('Note created');
    }
    setFormOpen(false);
    setEditNote(null);
  };

  const handleDelete = (id) => {
    deleteNote(id);
    setDeleteConfirm(null);
    toast.success('Note deleted');
  };

  const openNewNote = () => { setEditNote(null); setFormOpen(true); };
  const isFiltered = filter.trim().length > 0;

  return (
    <div style={{
      padding: isMobile ? 16 : 24,
      maxWidth: 900,
    }}>
      {/* ─── Header ──── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? 22 : 22,
            fontWeight: 800,
            fontFamily: F,
            color: C.t1,
            margin: 0,
          }}>
            Notes
          </h1>
          <p style={{ fontSize: 12, color: C.t3, margin: '4px 0 0', fontFamily: M }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {isFiltered && ` · ${filtered.length} match${filtered.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <Btn
          onClick={openNewNote}
          style={{
            fontSize: isMobile ? 13 : 12,
            padding: isMobile ? '10px 16px' : '8px 14px',
            minHeight: isMobile ? 44 : undefined,
          }}
        >
          + New Note
        </Btn>
      </div>

      {/* ─── Search ──── */}
      {notes.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="tf-input"
            style={{
              ...inputStyle,
              width: '100%',
              fontSize: isMobile ? 14 : 12,
              minHeight: isMobile ? 44 : undefined,
            }}
          />
          {isFiltered && (
            <button
              onClick={() => setFilter('')}
              className="tf-btn"
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: C.t3,
                fontSize: 14,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ─── Notes List ──── */}
      {filtered.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: 10,
          }}
          role="list"
          aria-label="Notes"
        >
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isMobile={isMobile}
              deleteConfirm={deleteConfirm}
              onEdit={() => { setEditNote(note); setFormOpen(true); }}
              onDeleteConfirm={() => setDeleteConfirm(note.id)}
              onDeleteCancel={() => setDeleteConfirm(null)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      ) : (
        <div>
          {notes.length === 0 ? (
            <NotesEmptyState onNewNote={openNewNote} />
          ) : (
            <Card>
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: C.t2, marginBottom: 8 }}>
                  No notes match "{filter}"
                </div>
                <button
                  onClick={() => setFilter('')}
                  className="tf-btn tf-link"
                  style={{
                    border: 'none', background: 'transparent',
                    color: C.b, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Clear search
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── Note Form Modal ──── */}
      <NoteFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditNote(null); }}
        onSave={handleSave}
        editNote={editNote}
        isMobile={isMobile}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NOTE CARD
// ═══════════════════════════════════════════════════════════════════

function NoteCard({ note, isMobile, deleteConfirm, onEdit, onDeleteConfirm, onDeleteCancel, onDelete }) {
  const isConfirming = deleteConfirm === note.id;

  return (
    <Card
      style={{ padding: isMobile ? 16 : 16 }}
      role="listitem"
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 15 : 14,
            fontWeight: 700,
            color: C.t1,
            marginBottom: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {note.title || 'Untitled'}
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
            {note.createdAt
              ? new Date(note.createdAt).toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })
              : '—'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
          {isConfirming ? (
            <>
              <Btn
                variant="ghost"
                onClick={onDeleteCancel}
                style={{ fontSize: 11, padding: isMobile ? '6px 10px' : '4px 8px' }}
              >
                Cancel
              </Btn>
              <Btn
                variant="danger"
                onClick={onDelete}
                style={{ fontSize: 11, padding: isMobile ? '6px 10px' : '4px 8px' }}
              >
                Delete
              </Btn>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="tf-btn tf-link"
                aria-label={`Edit ${note.title || 'note'}`}
                style={{
                  background: 'none', border: 'none',
                  color: C.t3, fontSize: 12, cursor: 'pointer',
                  padding: isMobile ? '6px 8px' : '2px 6px',
                  minHeight: isMobile ? 36 : undefined,
                }}
              >
                Edit
              </button>
              <button
                onClick={onDeleteConfirm}
                className="tf-btn tf-link"
                aria-label={`Delete ${note.title || 'note'}`}
                style={{
                  background: 'none', border: 'none',
                  color: C.t3, fontSize: 12, cursor: 'pointer',
                  padding: isMobile ? '6px 8px' : '2px 6px',
                  minHeight: isMobile ? 36 : undefined,
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content preview */}
      {note.content && (
        <div style={{
          fontSize: 13,
          color: C.t2,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          marginBottom: note.tags?.length ? 10 : 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
        }}>
          {note.content}
        </div>
      )}

      {/* Tags */}
      {note.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {note.tags.map((tag, i) => (
            <span
              key={i}
              style={{
                padding: '3px 8px',
                borderRadius: radii.sm,
                background: C.b + '12',
                color: C.b,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NOTE FORM MODAL
// ═══════════════════════════════════════════════════════════════════

function NoteFormModal({ isOpen, onClose, onSave, editNote, isMobile }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  React.useEffect(() => {
    if (isOpen && editNote) {
      setTitle(editNote.title || '');
      setContent(editNote.content || '');
      setTags(Array.isArray(editNote.tags) ? editNote.tags.join(', ') : '');
    } else if (isOpen) {
      setTitle('');
      setContent('');
      setTags('');
    }
  }, [isOpen, editNote]);

  const handleSubmit = () => {
    onSave({
      title: title.trim() || `Note — ${new Date().toLocaleDateString()}`,
      content: content.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  };

  const mInput = {
    ...inputStyle,
    fontSize: isMobile ? 14 : 13,
    minHeight: isMobile ? 44 : undefined,
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} width={560}>
      <h3 style={{
        fontSize: 16,
        fontWeight: 800,
        fontFamily: F,
        color: C.t1,
        margin: '0 0 16px',
      }}>
        {editNote ? 'Edit Note' : 'New Note'}
      </h3>

      <div style={{ marginBottom: 14 }}>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 4 }}
          htmlFor="note-title"
        >
          Title
        </label>
        <input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Note — ${new Date().toLocaleDateString()}`}
          style={{ ...mInput, fontWeight: 700 }}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 4 }}
          htmlFor="note-content"
        >
          Content
        </label>
        <textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Market observations, trade reflections, lessons learned..."
          rows={isMobile ? 8 : 10}
          style={{
            ...mInput,
            resize: 'vertical',
            minHeight: isMobile ? 160 : 180,
            lineHeight: 1.7,
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 4 }}
          htmlFor="note-tags"
        >
          Tags (comma-separated)
        </label>
        <input
          id="note-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. daily-review, market-analysis, psychology"
          style={mInput}
        />
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end',
      }}>
        <Btn
          variant="ghost"
          onClick={onClose}
          style={{ minHeight: isMobile ? 44 : undefined }}
        >
          Cancel
        </Btn>
        <Btn
          onClick={handleSubmit}
          style={{ minHeight: isMobile ? 44 : undefined }}
        >
          {editNote ? 'Save' : 'Create'}
        </Btn>
      </div>
    </ModalOverlay>
  );
}
