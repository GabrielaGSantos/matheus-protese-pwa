import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Profile } from '../types';
import { Search, Plus, Phone, Calendar, Mail, FileText, Check, X } from 'lucide-react';

export const DentistsScreen: React.FC = () => {
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [editingDentist, setEditingDentist] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchDentists();
  }, []);

  const fetchDentists = async () => {
    setLoading(true);
    try {
      const all = await api.profiles.list();
      setDentists(all.filter(p => p.role === 'dentist'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    try {
      if (editingDentist) {
        await api.profiles.save({
          ...editingDentist,
          full_name: name,
          whatsapp: whatsapp,
          notes: notes
        });
      } else {
        await api.profiles.create({
          role: 'dentist',
          full_name: name,
          whatsapp: whatsapp,
          notes: notes
        });
      }
      
      setSuccess(true);
      setName('');
      setWhatsapp('');
      setEmail('');
      setNotes('');
      setEditingDentist(null);
      
      setTimeout(() => {
        setSuccess(false);
        setShowForm(false);
        fetchDentists();
      }, 1500);

    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (dentist: Profile) => {
    setEditingDentist(dentist);
    setName(dentist.full_name);
    setWhatsapp(dentist.whatsapp || '');
    setNotes(dentist.notes || '');
    setShowForm(true);
  };

  const filteredDentists = dentists.filter(d => 
    d.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Dentistas Parceiros</h2>
          <p className="text-slate-500 text-xs mt-1">
            Gerencie e cadastre acessos para os dentistas que enviam casos para o seu laboratório.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all"
        >
          <Plus size={15} />
          Cadastrar Dentista
        </button>
      </div>

      {/* New/Edit Dentist Form */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex justify-center items-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-[#E2E8F0] rounded-2xl overflow-y-auto p-6 md:p-8 shadow-[0_4px_24px_rgba(15,23,42,0.08)] relative max-h-[90vh]">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingDentist(null);
                setName('');
                setWhatsapp('');
                setEmail('');
                setNotes('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-bold text-slate-900 mb-4">{editingDentist ? 'Editar Dentista' : 'Novo Dentista'}</h3>
            {success ? (
              <div className="flex flex-col items-center justify-center py-6 text-emerald-600 font-semibold gap-2 text-sm">
                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <Check size={20} />
                </div>
                {editingDentist ? 'Dentista atualizado com sucesso!' : 'Dentista cadastrado com sucesso!'}
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Dr. Lucas Medeiros"
                    className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                      WhatsApp / Telefone
                    </label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="Ex: 47999998888"
                      className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                      Login
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: lucas@dentista.com"
                      className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                    Observação
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anotações internas sobre preferências do dentista, prazos, etc."
                    className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
                  />
                </div>

                <p className="text-[10px] text-slate-400">
                  * No modo de demonstração, a senha padrão criada será <strong>123456</strong>. O login rápido do dentista ficará disponível na tela de login.
                </p>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingDentist(null);
                      setName('');
                      setWhatsapp('');
                      setEmail('');
                      setNotes('');
                    }}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-3.5 py-2 rounded-lg text-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Gravando...' : editingDentist ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
          <Search size={15} />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar dentista por nome..."
          className="w-full pl-10 pr-4 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
        />
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-500 text-sm font-medium">
          Carregando lista de dentistas...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDentists.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400 text-xs border border-dashed border-[#E2E8F0] rounded-xl">
              Nenhum dentista encontrado para a busca.
            </div>
          ) : (
            filteredDentists.map((d) => (
              <div key={d.id} className="glass-panel p-4 flex flex-col justify-between hover:shadow-sm transition-all">
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">{d.full_name}</h4>
                  <span className="text-[9px] uppercase font-bold text-[#0F766E] px-1.5 py-px rounded-full bg-[#ECFDF5] border border-emerald-100 inline-block mt-1">
                    Dentista Parceiro
                  </span>
                  
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Mail size={12} className="text-slate-400" />
                      <span>{d.full_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@dentista.com</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Calendar size={12} className="text-slate-400" />
                      <span>Cadastrado em {new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {d.notes && (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-[#E2E8F0] text-[10px] text-slate-500 mt-2 leading-relaxed">
                        <strong className="text-slate-700 block mb-0.5">Observação:</strong>
                        {d.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-[#E2E8F0]">
                  {d.whatsapp && (
                    <a
                      href={`https://wa.me/55${d.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] text-center rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Phone size={11} className="text-emerald-500" />
                      WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => startEdit(d)}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] text-center rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <FileText size={11} className="text-slate-400" />
                    Editar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
