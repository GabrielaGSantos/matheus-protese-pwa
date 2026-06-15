import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { InternalNote } from '../types';
import { 
  StickyNote, 
  Search, 
  Plus, 
  Trash2, 
  Pin, 
  AlertCircle, 
  History, 
  Check, 
  Loader2, 
  Calendar, 
  User 
} from 'lucide-react';

export const NotesScreen: React.FC = () => {
  const { user } = useAuth();
  
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Editor State
  const [selectedNote, setSelectedNote] = useState<InternalNote | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [important, setImportant] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const data = await api.notes.list();
      setNotes(data);
      // Auto-select first note if none selected and notes exist
      if (data.length > 0 && !selectedNote) {
        handleSelectNote(data[0]);
      }
    } catch (err) {
      console.error('Erro ao buscar notas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNote = (note: InternalNote) => {
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setPinned(note.pinned);
    setImportant(note.important);
  };

  const handleNewNote = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setPinned(false);
    setImportant(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('Por favor, preencha o título e o conteúdo da nota.');
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const notePayload: InternalNote = {
        id: selectedNote?.id || '',
        title: title.trim(),
        content: content.trim(),
        pinned,
        important,
        created_at: selectedNote?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: selectedNote?.created_by || user.id,
        history: selectedNote?.history || []
      };

      const saved = await api.notes.save(notePayload, user.id, user.full_name);
      
      alert(selectedNote ? 'Anotação atualizada com sucesso!' : 'Anotação criada com sucesso!');
      
      // Refresh list
      const updatedList = await api.notes.list();
      setNotes(updatedList);
      
      // Keep selected
      const reselected = updatedList.find(n => n.id === saved.id) || saved;
      handleSelectNote(reselected);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar anotação: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    if (!window.confirm('Tem certeza de que deseja excluir permanentemente esta anotação?')) return;

    setSaving(true);
    try {
      await api.notes.delete(selectedNote.id);
      alert('Anotação excluída com sucesso!');
      
      // Reset editor
      handleNewNote();
      
      // Refresh list
      const updatedList = await api.notes.list();
      setNotes(updatedList);
      
      if (updatedList.length > 0) {
        handleSelectNote(updatedList[0]);
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir anotação: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredNotes = notes.filter(n => {
    const query = search.toLowerCase();
    return n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6 text-slate-900">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-[#E2E8F0]">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <StickyNote className="text-[#0F766E]" size={26} />
            Bloco de Notas Interno
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Crie lembretes, anotações de laboratório, tarefas importantes e compartilhe entre administradores e secretárias.
          </p>
        </div>
        <button
          onClick={handleNewNote}
          className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          Nova Nota
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Notes list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] pointer-events-none">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por título ou conteúdo..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] text-[#0F172A]"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              Carregando notas...
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs italic border border-dashed border-[#E2E8F0] rounded-xl bg-white p-4">
                  Nenhuma nota encontrada.
                </div>
              ) : (
                filteredNotes.map(n => {
                  const isSelected = selectedNote?.id === n.id;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleSelectNote(n)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-teal-50/40 border-teal-200 shadow-sm' 
                          : 'bg-white border-[#E2E8F0] hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-1 flex-1">
                          {n.title}
                        </h4>
                        <div className="flex gap-1 shrink-0">
                          {n.pinned && (
                            <span className="text-[#0F766E]" title="Nota Fixada">
                              <Pin size={11} className="fill-current" />
                            </span>
                          )}
                          {n.important && (
                            <span className="text-rose-500" title="Nota Importante">
                              <AlertCircle size={11} className="fill-current" />
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {n.content}
                      </p>

                      <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium mt-3 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          {n.created_by_name || 'Admin'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(n.updated_at || n.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Right Side: Detailed Editor */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                {selectedNote ? 'Editar Anotação' : 'Nova Anotação'}
              </h3>
              {selectedNote && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="p-1.5 rounded-lg border border-rose-100 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                  title="Excluir Nota"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Título da Nota
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Senha do compressor ou Lista de Afazeres..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Conteúdo da Anotação
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder="Escreva sua anotação detalhada aqui..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-medium text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                  />
                  <span className="flex items-center gap-1">
                    <Pin size={12} className="text-teal-600" />
                    Fixar no topo
                  </span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={important}
                    onChange={(e) => setImportant(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                  />
                  <span className="flex items-center gap-1">
                    <AlertCircle size={12} className="text-rose-500" />
                    Marcar como importante
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              {selectedNote && (
                <button
                  type="button"
                  onClick={handleNewNote}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                >
                  Criar Nova
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="bg-[#0F766E] hover:bg-[#115E59] text-white font-bold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {selectedNote ? 'Atualizar Nota' : 'Salvar Nota'}
              </button>
            </div>
          </form>

          {/* Note edit history audit logs */}
          {selectedNote && selectedNote.history && selectedNote.history.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                <History size={12} />
                Histórico de Atualizações
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedNote.history.map((h, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-[#E2E8F0] text-[10px] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800">{h.user_name}</span>
                      <span className="text-slate-400 ml-1.5">({h.action})</span>
                    </div>
                    <span className="text-slate-400 font-medium">
                      {new Date(h.updated_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
