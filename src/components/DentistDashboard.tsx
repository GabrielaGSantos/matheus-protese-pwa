import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, Service, OdontogramSelection, CaseStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Odontogram } from './Odontogram';
import { 
  AlertCircle, Calendar, DollarSign, 
  Clock, CheckCircle, FolderOpen, Send, Paperclip 
} from 'lucide-react';

interface DentistDashboardProps {
  initialTab?: 'my-cases' | 'new-case';
}

export const DentistDashboard: React.FC<DentistDashboardProps> = ({ initialTab = 'my-cases' }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [activeTab, setActiveTab] = useState<'my-cases' | 'new-case'>(initialTab);
  const [loading, setLoading] = useState(true);

  // New Case Form state
  const [patientName, setPatientName] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [dentistNotes, setDentistNotes] = useState('');
  const [teethSelection, setTeethSelection] = useState<OdontogramSelection>({ teeth: [], type: 'individual' });
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<{ name: string; size: number }[]>([]);
  const [scanFiles, setScanFiles] = useState<{ name: string; size: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Editing state for Dentist
  const [editingCase, setEditingCase] = useState<Case | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const c = await api.cases.list('dentist', user.id);
      const s = await api.services.list();
      setCases(c);
      setServices(s);
      // Set default requested date (7 days from now)
      setRequestedDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !patientName) return;

    const selectedIds = Object.keys(selectedServices).filter(id => selectedServices[id]);
    if (selectedIds.length === 0) {
      alert('Por favor, selecione pelo menos um serviço/procedimento.');
      return;
    }

    setSubmitting(true);
    try {
      const teethQty = teethSelection.teeth.length || 1;
      
      let computedTotalValue = 0;
      let totalEstHours = 0;
      let valMatheus = 0;
      let valPaschoal = 0;

      selectedIds.forEach(id => {
        const s = services.find(srv => srv.id === id);
        if (s) {
          const qtyMultiplier = s.billing_type === 'per_element' ? teethQty : 1;
          const computedServiceValue = s.default_value * qtyMultiplier;
          totalEstHours += s.default_estimated_time * qtyMultiplier;
          computedTotalValue += computedServiceValue;
          if (s.enters_matheus_value) {
            valMatheus += computedServiceValue;
          }
          if (s.enters_paschoal_value) {
            valPaschoal += computedServiceValue;
          }
        }
      });

      const payload: Case = {
        id: editingCase?.id || `CASE-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(cases.length + 1).padStart(4, '0')}`,
        dentist_id: user.id,
        patient_name: patientName,
        created_at: editingCase?.created_at || new Date().toISOString(),
        requested_delivery_date: requestedDate,
        final_delivery_date: editingCase?.final_delivery_date, // Admin sets this
        status: 'em_analise', // Forcing status to "Aguardando análise" when client submits/edits
        financial_status: editingCase?.financial_status || 'aguardando_pagamento',
        teeth_selection: teethSelection,
        dentist_notes: dentistNotes,
        has_photo: hasPhoto || photoFiles.length > 0,
        has_file: hasFile || scanFiles.length > 0,
        estimated_hours: totalEstHours,
        value_matheus: valMatheus,
        value_planning: editingCase?.value_planning || 0,
        value_paschoal: valPaschoal,
        cost_allan_matheus: editingCase?.cost_allan_matheus || 0,
        cost_allan_solo: editingCase?.cost_allan_solo || 0,
        cost_andrey: editingCase?.cost_andrey || 0,
        other_internal_costs: editingCase?.other_internal_costs || [],
        total_value: computedTotalValue,
        paid_value: editingCase?.paid_value || 0,
        remaining_value: computedTotalValue - (editingCase?.paid_value || 0),
        google_drive_folder_id: editingCase?.google_drive_folder_id || `folder-mock-${Date.now()}`,
        google_drive_folder_url: editingCase?.google_drive_folder_url || `https://drive.google.com/drive/folders/mock-${Date.now()}`,
        selected_services: selectedIds,
        updated_at: new Date().toISOString()
      };

      await api.cases.save(payload, user.id);
      
      // Reset form
      setPatientName('');
      setDentistNotes('');
      setTeethSelection({ teeth: [], type: 'individual' });
      setHasPhoto(false);
      setHasFile(false);
      setPhotoFiles([]);
      setScanFiles([]);
      setSelectedServices({});
      setEditingCase(null);
      setActiveTab('my-cases');
      
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (caseItem: Case) => {
    setEditingCase(caseItem);
    setPatientName(caseItem.patient_name);
    setRequestedDate(caseItem.requested_delivery_date);
    setDentistNotes(caseItem.dentist_notes || '');
    setTeethSelection(caseItem.teeth_selection);
    setHasPhoto(caseItem.has_photo);
    setHasFile(caseItem.has_file);

    // Populate selected services
    const servicesMap: Record<string, boolean> = {};
    if (caseItem.selected_services) {
      caseItem.selected_services.forEach(id => {
        servicesMap[id] = true;
      });
    } else {
      // Fallback match by value
      const matched = services.find(s => s.default_value === caseItem.total_value);
      if (matched) {
        servicesMap[matched.id] = true;
      }
    }
    setSelectedServices(servicesMap);
    setPhotoFiles([]);
    setScanFiles([]);
    setActiveTab('new-case');
  };

  // Separations
  const activeCases = cases.filter(c => !['finalizado', 'entregue', 'cancelado'].includes(c.status));
  const finalizedCases = cases.filter(c => ['finalizado', 'entregue'].includes(c.status));

  // Financial totals
  const totalOwed = cases
    .filter(c => c.financial_status !== 'pago' && c.financial_status !== 'isento' && c.status !== 'cancelado')
    .reduce((sum, c) => sum + c.remaining_value, 0);

  const getStatusBadge = (status: CaseStatus) => {
    const styles: Record<CaseStatus, string> = {
      recebido: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      em_analise: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      aguardando_aprovacao: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      aguardando_arquivos: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      em_execucao: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      finalizado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      entregue: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
      cancelado: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };
    return (
      <span className={`px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide rounded-full border ${styles[status]}`}>
        {status === 'em_analise' ? 'Aguardando Análise' : status.replace('_', ' ')}
      </span>
    );
  };

  const dentistAllowedNames = [
    'enceramento digital',
    'impressao',
    'coroa de dissilicato',
    'coroa em zirconia',
    'coroa zirconia',
    'protocolo zirconia',
    'modelo total',
    'placa'
  ];
  const dentistServices = services.filter(s => 
    dentistAllowedNames.includes(s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Portal do Dentista</h2>
          <p className="text-muted-foreground text-sm">
            Envie novos pedidos de prótese, envie escaneamentos/arquivos e controle seu extrato financeiro.
          </p>
        </div>

        {/* Total Owed card */}
        <div className="bg-primary/10 border border-primary/20 px-5 py-3 rounded-2xl flex items-center gap-3 w-fit">
          <div className="p-2 bg-primary rounded-xl text-white">
            <DollarSign size={18} />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Saldo Devedor Geral</span>
            <span className="text-base font-black text-foreground">R$ {totalOwed.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 w-fit gap-1 bg-secondary/30 p-1.5 rounded-xl">
        <button
          onClick={() => {
            setActiveTab('my-cases');
            setEditingCase(null);
          }}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'my-cases'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Meus Casos
        </button>
        <button
          onClick={() => setActiveTab('new-case')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'new-case'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {editingCase ? 'Editar Solicitação' : 'Solicitar Novo Trabalho'}
        </button>
      </div>

      {activeTab === 'my-cases' ? (
        /* MY CASES TAB */
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando seus casos...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Active Cases column */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Clock size={18} className="text-primary" />
                  Pedidos em Andamento ({activeCases.length})
                </h3>

                <div className="space-y-3">
                  {activeCases.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-white/5 bg-card rounded-2xl">
                      Nenhum pedido ativo no momento.
                    </div>
                  ) : (
                    activeCases.map(c => (
                      <div key={c.id} className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-muted-foreground font-bold">{c.id}</span>
                            <h4 className="font-bold text-base text-foreground leading-snug">{c.patient_name}</h4>
                          </div>
                          
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => startEdit(c)}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-secondary hover:bg-secondary/80 border border-white/5 text-foreground transition-all"
                            >
                              Editar
                            </button>
                            {c.google_drive_folder_url && (
                              <a
                                href={c.google_drive_folder_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                              >
                                <FolderOpen size={14} />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs py-3 border-t border-b border-white/5">
                          <div>
                            <span className="text-muted-foreground block text-[9px] font-bold uppercase tracking-wider">Status Clínico</span>
                            {getStatusBadge(c.status)}
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[9px] font-bold uppercase tracking-wider">Previsão Entrega</span>
                            <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                              <Calendar size={12} className="text-muted-foreground" />
                              {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-muted-foreground">Custo Total:</span>
                          <span className="text-foreground font-bold text-sm">
                            R$ {c.total_value.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Finalized Cases column */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-500" />
                  Trabalhos Concluídos ({finalizedCases.length})
                </h3>

                <div className="space-y-3">
                  {finalizedCases.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-white/5 bg-card rounded-2xl">
                      Nenhum trabalho concluído ainda.
                    </div>
                  ) : (
                    finalizedCases.map(c => (
                      <div key={c.id} className="glass-panel p-5 rounded-2xl border border-white/5 opacity-85 hover:opacity-100 hover:shadow-md transition-all space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-muted-foreground font-bold">{c.id}</span>
                            <h4 className="font-bold text-base text-foreground leading-snug">{c.patient_name}</h4>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-extrabold uppercase tracking-widest">
                            Entregue / Pronto
                          </span>
                        </div>

                        <div className="flex justify-between text-xs py-2 border-t border-b border-white/5">
                          <div>
                            <span className="text-muted-foreground block text-[9px] font-bold uppercase tracking-wider">Pago</span>
                            <span className="font-bold text-emerald-500">R$ {c.paid_value.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[9px] font-bold uppercase tracking-wider">Aberto</span>
                            <span className="font-bold text-foreground">R$ {c.remaining_value.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-muted-foreground">Valor Matheus:</span>
                          <span className="text-foreground font-bold">R$ {c.value_matheus.toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      ) : (
        /* SOLICITAR NOVO TRABALHO TAB */
        <div className="glass-panel p-6 rounded-2xl border border-white/10 max-w-2xl animate-fade-in space-y-6">
          <div>
            <h3 className="text-lg font-bold">
              {editingCase ? 'Editar Solicitação' : 'Nova Solicitação de Serviço'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Cadastre o nome do paciente, selecione os dentes e insira observações para o Dr. Matheus.
            </p>
          </div>

          {/* Alert / Informational disclaimer */}
          <div className="p-4 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex gap-3 text-xs leading-relaxed font-medium">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>
              <strong>Atenção:</strong> A data solicitada abaixo é apenas uma indicação da sua necessidade de agenda. 
              A data oficial de entrega será analisada e confirmada pelo Dr. Matheus de acordo com a fila de produção.
            </p>
          </div>

          <form onSubmit={handleCreateCase} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Nome do Paciente
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nome do paciente (apenas nome)"
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-white/10 text-foreground text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Data de Entrega Solicitada
                </label>
                <input
                  type="date"
                  required
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-white/10 text-foreground text-sm font-medium"
                />
              </div>
            </div>

            {/* Checklist of allowed services (multi-selection, hidden prices) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Procedimento(s) Requerido(s) (Selecione um ou mais)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-secondary/10 p-4 rounded-xl border border-white/5">
                {dentistServices.map(s => {
                  const isChecked = !!selectedServices[s.id];
                  return (
                    <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-white/5 hover:bg-secondary/40 transition-all">
                      <input
                        type="checkbox"
                        id={`dentist-serv-${s.id}`}
                        checked={isChecked}
                        onChange={(e) => {
                          setSelectedServices({
                            ...selectedServices,
                            [s.id]: e.target.checked
                          });
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <label htmlFor={`dentist-serv-${s.id}`} className="text-xs font-semibold text-foreground cursor-pointer flex-1">
                        {s.name}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Odontogram selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Selecione os elementos
              </label>
              <Odontogram value={teethSelection} onChange={setTeethSelection} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Observações Clínicas / Recomendações
              </label>
              <textarea
                rows={3}
                value={dentistNotes}
                onChange={(e) => setDentistNotes(e.target.value)}
                placeholder="Insira detalhes adicionais sobre cor, material, espessura ou particularidades..."
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-white/10 text-foreground text-sm"
              />
            </div>

            {/* File Upload zones (Separate Fotos / Escaneamentos) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fotos Clínicas zone */}
              <div className="p-5 rounded-2xl border border-dashed border-white/10 bg-secondary/10 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <Paperclip size={14} />
                  Enviar Fotos Clínicas
                </div>
                <p className="text-[10px] text-muted-foreground">Arraste ou clique para enviar fotos clínicas (JPG, PNG).</p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const mapped = files.map(f => ({ name: f.name, size: f.size }));
                    setPhotoFiles(prev => [...prev, ...mapped]);
                    setHasPhoto(true);
                  }}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
                />
                {photoFiles.length > 0 && (
                  <div className="space-y-1 pt-1.5">
                    {photoFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center bg-card p-2 rounded-xl text-[10px] border border-white/5">
                        <span className="truncate max-w-[150px] text-foreground font-semibold">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = photoFiles.filter((_, idx) => idx !== i);
                            setPhotoFiles(updated);
                            if (updated.length === 0) setHasPhoto(false);
                          }}
                          className="text-rose-500 hover:text-rose-600 font-bold px-1.5"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Escaneamentos 3D zone */}
              <div className="p-5 rounded-2xl border border-dashed border-white/10 bg-secondary/10 space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <Paperclip size={14} />
                  Enviar Escaneamento (3D)
                </div>
                <p className="text-[10px] text-muted-foreground">Arraste ou clique para enviar escaneamentos 3D (STL, OBJ, PLY, ZIP).</p>
                <input
                  type="file"
                  multiple
                  accept=".stl,.obj,.ply,.zip,.rar"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const mapped = files.map(f => ({ name: f.name, size: f.size }));
                    setScanFiles(prev => [...prev, ...mapped]);
                    setHasFile(true);
                  }}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
                />
                {scanFiles.length > 0 && (
                  <div className="space-y-1 pt-1.5">
                    {scanFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center bg-card p-2 rounded-xl text-[10px] border border-white/5">
                        <span className="truncate max-w-[150px] text-foreground font-semibold">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = scanFiles.filter((_, idx) => idx !== i);
                            setScanFiles(updated);
                            if (updated.length === 0) setHasFile(false);
                          }}
                          className="text-rose-500 hover:text-rose-600 font-bold px-1.5"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setEditingCase(null);
                  setActiveTab('my-cases');
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-secondary transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="glow-btn bg-primary hover:bg-primary/95 text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-1.5 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                <Send size={14} />
                {submitting ? 'Enviando...' : editingCase ? 'Salvar Alterações' : 'Enviar Solicitação'}
              </button>
            </div>

          </form>

        </div>
      )}
    </div>
  );
};
