import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Profile } from '../types';
import { Search, Plus, Phone, Calendar, Mail, FileText, Check, X, ChevronLeft, ChevronRight, Trash2, Users, Copy, KeyRound, Edit2 } from 'lucide-react';

export const DentistsScreen: React.FC = () => {
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [auxiliars, setAuxiliars] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [userLogin, setUserLogin] = useState('');
  const [notes, setNotes] = useState('');
  const [editingDentist, setEditingDentist] = useState<Profile | null>(null);
  const [addingAuxiliarFor, setAddingAuxiliarFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{login: string, role: string, password?: string} | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDentists();
  }, []);

  const fetchDentists = async () => {
    setLoading(true);
    try {
      const all = await api.profiles.list();
      setDentists(all.filter(p => p.role === 'dentist'));
      setAuxiliars(all.filter(p => p.role === 'auxiliar'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir permanentemente este dentista?')) return;
    setLoading(true);
    try {
      await api.profiles.delete(id);
      fetchDentists();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir dentista.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (profile: Profile) => {
    if (!window.confirm(`Tem certeza que deseja gerar uma nova senha aleatória para ${profile.full_name}?`)) return;
    setLoading(true);
    try {
      const newPassword = await api.profiles.resetPassword(profile.id);
      
      let emailBase = profile.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      if (profile.role === 'auxiliar') emailBase = 'auxiliar_' + emailBase;
      
      setGeneratedCredentials({
        login: emailBase,
        password: newPassword,
        role: profile.role === 'auxiliar' ? 'auxiliar' : 'dentista'
      });
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao resetar senha: ${err.message}`);
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
        const newProfile = await api.profiles.create({
          role: addingAuxiliarFor ? 'auxiliar' : 'dentist',
          linked_dentist_id: addingAuxiliarFor || undefined,
          full_name: name,
          whatsapp: whatsapp,
          notes: notes
        }, userLogin.trim() || undefined);
        
        if ((newProfile as any)._generatedEmail) {
           const userLoginName = (newProfile as any)._generatedEmail.split('@')[0];
           setGeneratedCredentials({ 
             login: userLoginName, 
             password: (newProfile as any)._generatedPassword || 'cad_123456',
             role: addingAuxiliarFor ? 'auxiliar' : 'dentista' 
           });
        }
      }
      
      setSuccess(true);
      setName('');
      setWhatsapp('');
      setUserLogin('');
      setNotes('');
      setEditingDentist(null);
      setAddingAuxiliarFor(null);
      
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

  const handleCopy = () => {
    if (!generatedCredentials) return;
    const text = `Acesso ao Sistema\nUsuário: ${generatedCredentials.login}\nSenha: ${generatedCredentials.password || 'cad_123456'}\nLink: https://matheus-odontologia-digital.vercel.app`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEdit = (dentist: Profile) => {
    setEditingDentist(dentist);
    setAddingAuxiliarFor(dentist.role === 'auxiliar' ? (dentist.linked_dentist_id || null) : null);
    setName(dentist.full_name);
    setWhatsapp(dentist.whatsapp || '');
    setNotes(dentist.notes || '');
    setUserLogin('');
    setShowForm(true);
  };

  const startAddAuxiliar = (dentistId: string) => {
    setEditingDentist(null);
    setAddingAuxiliarFor(dentistId);
    setName('');
    setWhatsapp('');
    setUserLogin('');
    setNotes('');
    setShowForm(true);
  };

  const filteredDentists = dentists.filter(d => 
    d.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredDentists.length / itemsPerPage));
  const paginatedDentists = filteredDentists.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-[#E2E8F0] rounded-2xl overflow-y-auto p-6 md:p-8 shadow-[0_4px_24px_rgba(15,23,42,0.08)] relative max-h-[90vh]">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingDentist(null);
                setAddingAuxiliarFor(null);
                setName('');
                setWhatsapp('');
                setUserLogin('');
                setNotes('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              {editingDentist 
                ? (editingDentist.role === 'auxiliar' ? 'Editar Auxiliar' : 'Editar Dentista')
                : (addingAuxiliarFor ? 'Novo Auxiliar' : 'Novo Dentista')}
            </h3>
            {success ? (
              <div className="flex flex-col items-center justify-center py-6 text-emerald-600 font-semibold gap-2 text-sm">
                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <Check size={20} />
                </div>
                {editingDentist ? 'Cadastro editado com sucesso' : 'Cadastro realizado com sucesso'}
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
                    placeholder={addingAuxiliarFor ? "Ex: Ana Beatriz (Auxiliar)" : "Ex: Dr. Lucas Medeiros"}
                    className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                      Usuário de Acesso (Login)
                    </label>
                    <input
                      type="text"
                      disabled={!!editingDentist}
                      value={userLogin}
                      onChange={(e) => setUserLogin(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder={editingDentist ? "Não é possível alterar" : "Deixe em branco p/ gerar auto."}
                      className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
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
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                    Observação
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={addingAuxiliarFor ? "Anotações internas sobre a função do auxiliar." : "Anotações internas sobre preferências do dentista, prazos, etc."}
                    className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
                  />
                </div>

                <p className="text-[10px] text-slate-400">
                  * No modo de demonstração, a senha padrão criada será <strong>123456</strong>. 
                  {addingAuxiliarFor 
                    ? " Para acessar como auxiliar, digite aux_ seguido do nome do dentista vinculado na tela de login rápido."
                    : " O login rápido do dentista ficará disponível na tela de login."}
                </p>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingDentist(null);
                      setAddingAuxiliarFor(null);
                      setName('');
                      setWhatsapp('');
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedDentists.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-400 text-xs border border-dashed border-[#E2E8F0] rounded-xl">
                Nenhum dentista encontrado para a busca.
              </div>
            ) : (
              paginatedDentists.map((d) => {
                const myAuxiliars = auxiliars.filter(a => a.linked_dentist_id === d.id);
                return (
                <div key={d.id} className="glass-panel p-4 flex flex-col justify-between hover:shadow-sm transition-all">
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">{d.full_name}</h4>
                    
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
                    {/* Auxiliaries Section */}
                    <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Users size={12} />
                          Equipe ({myAuxiliars.length})
                        </span>
                      </div>
                    </div>
                  </div>

                  {d.notes && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2 bg-white p-3 rounded-xl border border-slate-100">
                      {d.notes}
                    </p>
                  )}
                  
                  {myAuxiliars.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Auxiliares / Secretárias</div>
                      {myAuxiliars.map(aux => (
                        <div key={aux.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                          <span className="text-xs font-semibold text-slate-700">{aux.full_name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(aux)}
                              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                              title="Editar Auxiliar"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleResetPassword(aux)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Resetar Senha"
                            >
                              <KeyRound size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(aux.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Excluir Auxiliar"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-200/60">
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
                      onClick={() => startAddAuxiliar(d.id)}
                      className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] text-center rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Adicionar Auxiliar/Secretária"
                    >
                      <Plus size={11} className="text-teal-600" />
                      Auxiliar
                    </button>
                    <button
                      onClick={() => handleResetPassword(d)}
                      className="py-1.5 px-3 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 text-center rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Resetar Senha"
                    >
                      <KeyRound size={11} />
                    </button>
                    <button
                      onClick={() => startEdit(d)}
                      className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] text-center rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FileText size={11} className="text-slate-400" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-center rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Excluir Dentista"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[#E2E8F0] gap-4 text-xs font-medium text-slate-500 mt-6">
              <div>
                Exibindo {Math.min(filteredDentists.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(filteredDentists.length, currentPage * itemsPerPage)} de {filteredDentists.length} dentistas
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-2 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                  title="Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-semibold text-slate-700">Página {currentPage} de {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="p-2 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                  title="Próximo"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Credentials Modal */}
      {generatedCredentials && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white text-center relative">
              <button 
                onClick={() => setGeneratedCredentials(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                <Check size={32} className="text-white drop-shadow-md" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Acesso Gerado!</h2>
              <p className="text-emerald-100 text-sm">
                O perfil de {generatedCredentials.role} foi configurado com sucesso.
              </p>
            </div>
            
            <div className="p-8">
              <p className="text-slate-600 text-sm mb-6 text-center">
                Envie os dados abaixo para o profissional acessar o sistema:
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 space-y-4 relative">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Usuário (Login)</div>
                  <div className="text-lg font-bold text-slate-800">{generatedCredentials.login}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Senha Gerada</div>
                  <div className="text-lg font-bold text-slate-800 font-mono tracking-wider">{generatedCredentials.password}</div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setGeneratedCredentials(null)}
                  className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl transition-all text-sm"
                >
                  Fechar
                </button>
                <button
                  onClick={handleCopy}
                  className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow"
                >
                  {copied ? (
                    <>
                      <Check size={18} />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copiar Dados
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
