import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Profile } from '../types';
import { Search, Plus, Phone, Calendar, Mail, FileText, Check } from 'lucide-react';

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
          <h2 className="text-3xl font-extrabold tracking-tight">Dentistas Parceiros</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie e cadastre acessos para os dentistas que enviam casos para o seu laboratório.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="glow-btn bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Cadastrar Dentista
        </button>
      </div>

      {/* New/Edit Dentist Form Modal/Drawer */}
      {showForm && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 relative animate-fade-in max-w-lg">
          <h3 className="text-lg font-bold mb-4">{editingDentist ? 'Editar Dentista' : 'Novo Dentista'}</h3>
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-emerald-500 font-bold gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check size={24} />
              </div>
              {editingDentist ? 'Dentista atualizado com sucesso!' : 'Dentista cadastrado com sucesso!'}
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Dr. Lucas Medeiros"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="Ex: 47999998888"
                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    E-mail de Login
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: lucas@dentista.com"
                    className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                  />
                </div>
              </div>

              {/* Observação / Notas */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Observação
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações internas sobre preferências do dentista, prazos, etc."
                  className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                />
              </div>

              <p className="text-[10px] text-muted-foreground">
                * No modo de demonstração, a senha padrão criada será <strong>123456</strong>. O login rápido do dentista ficará disponível na tela de login.
              </p>

              <div className="flex justify-end gap-3 pt-2">
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
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-secondary transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {saving ? 'Gravando...' : editingDentist ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground pointer-events-none">
          <Search size={18} />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar dentista por nome..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-white/10 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
        />
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center py-12 text-muted-foreground">
          Carregando lista de dentistas...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDentists.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm border border-dashed border-white/10 rounded-2xl">
              Nenhum dentista encontrado para a busca.
            </div>
          ) : (
            filteredDentists.map((d) => (
              <div key={d.id} className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
                <div>
                  <h4 className="font-bold text-lg text-foreground">{d.full_name}</h4>
                  <span className="text-[10px] uppercase font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 inline-block mt-1">
                    Dentista Parceiro
                  </span>
                  
                  <div className="space-y-2.5 mt-5">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <Mail size={14} className="text-muted-foreground/75" />
                      <span>{d.full_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@dentista.com</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <Calendar size={14} className="text-muted-foreground/75" />
                      <span>Cadastrado em {new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {d.notes && (
                      <div className="bg-secondary/40 p-3 rounded-xl border border-white/5 text-[11px] text-muted-foreground mt-3 leading-relaxed">
                        <strong className="text-foreground block mb-0.5">Observação:</strong>
                        {d.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-white/5">
                  {d.whatsapp && (
                    <a
                      href={`https://wa.me/55${d.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-center rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300"
                    >
                      <Phone size={12} />
                      WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => startEdit(d)}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-white/5 text-center rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300"
                  >
                    <FileText size={12} />
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
