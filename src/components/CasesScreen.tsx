import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, Profile, Service, CaseStatus, FinancialStatus, OdontogramSelection, CaseHistory } from '../types';
import { Odontogram } from './Odontogram';
import { 
  Search, Plus, Edit2, Trash2, Calendar, 
  X, FolderOpen, History 
} from 'lucide-react';

interface CasesScreenProps {
  initialEditingCaseId?: string | null;
  clearInitialEditingCaseId?: () => void;
}

export const CasesScreen: React.FC<CasesScreenProps> = ({
  initialEditingCaseId,
  clearInitialEditingCaseId
}) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dentistFilter, setDentistFilter] = useState<string>('todos');
  const [loading, setLoading] = useState(true);

  // Editor states
  const [showEditor, setShowEditor] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<'info' | 'financial' | 'history'>('info');

  // Case Form fields
  const [selectedDentistId, setSelectedDentistId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [finalDeliveryDate, setFinalDeliveryDate] = useState('');
  const [caseStatus, setCaseStatus] = useState<CaseStatus>('recebido');
  const [financialStatus, setFinancialStatus] = useState<FinancialStatus>('aguardando_pagamento');
  const [teethSelection, setTeethSelection] = useState<OdontogramSelection>({ teeth: [], type: 'individual' });
  const [dentistNotes, setDentistNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasFile, setHasFile] = useState(false);

  // Services checked in the case editor
  const [caseServicesSelected, setCaseServicesSelected] = useState<Record<string, { selected: boolean; quantity: number }>>({});

  // Financial override fields
  const [overrideValueMatheus, setOverrideValueMatheus] = useState('');
  const [overrideValuePlanning, setOverrideValuePlanning] = useState('');
  const [overrideValuePaschoal, setOverrideValuePaschoal] = useState('');
  const [costAllanMatheus, setCostAllanMatheus] = useState('');
  const [costAllanSolo, setCostAllanSolo] = useState('');
  const [costAndrey, setCostAndrey] = useState('');
  const [paidValue, setPaidValue] = useState('');

  // History log
  const [historyLogs, setHistoryLogs] = useState<CaseHistory[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialEditingCaseId && cases.length > 0) {
      const foundCase = cases.find(c => c.id === initialEditingCaseId);
      if (foundCase) {
        setEditingCase(foundCase);
        setShowEditor(true);
        setActiveEditorTab('info');
      }
      if (clearInitialEditingCaseId) {
        clearInitialEditingCaseId();
      }
    }
  }, [initialEditingCaseId, cases, clearInitialEditingCaseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const c = await api.cases.list('admin', 'admin-1');
      const p = await api.profiles.list();
      const s = await api.services.list();
      
      setCases(c);
      const dentistList = p.filter(x => x.role === 'dentist');
      setDentists(dentistList);
      setServices(s);
      
      if (dentistList.length > 0) {
        setSelectedDentistId(dentistList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger when editing case is selected
  useEffect(() => {
    if (!editingCase) {
      // Reset to defaults
      if (dentists.length > 0) setSelectedDentistId(dentists[0].id);
      setPatientName('');
      setRequestedDeliveryDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setFinalDeliveryDate('');
      setCaseStatus('recebido');
      setFinancialStatus('aguardando_pagamento');
      setTeethSelection({ teeth: [], type: 'individual' });
      setDentistNotes('');
      setInternalNotes('');
      setHasPhoto(false);
      setHasFile(false);
      setOverrideValueMatheus('');
      setOverrideValuePlanning('');
      setOverrideValuePaschoal('');
      setCostAllanMatheus('0');
      setCostAllanSolo('0');
      setCostAndrey('0');
      setPaidValue('0');
      setCaseServicesSelected({});
      setHistoryLogs([]);
      return;
    }

    // Set fields from editing case
    setSelectedDentistId(editingCase.dentist_id);
    setPatientName(editingCase.patient_name);
    setRequestedDeliveryDate(editingCase.requested_delivery_date);
    setFinalDeliveryDate(editingCase.final_delivery_date || '');
    setCaseStatus(editingCase.status);
    setFinancialStatus(editingCase.financial_status);
    setTeethSelection(editingCase.teeth_selection);
    setDentistNotes(editingCase.dentist_notes || '');
    setInternalNotes(editingCase.internal_notes || '');
    setHasPhoto(editingCase.has_photo);
    setHasFile(editingCase.has_file);

    // Overrides
    setOverrideValueMatheus(String(editingCase.value_matheus));
    setOverrideValuePlanning(String(editingCase.value_planning));
    setOverrideValuePaschoal(String(editingCase.value_paschoal));
    setCostAllanMatheus(String(editingCase.cost_allan_matheus));
    setCostAllanSolo(String(editingCase.cost_allan_solo));
    setCostAndrey(String(editingCase.cost_andrey));
    setPaidValue(String(editingCase.paid_value));

    // Retrieve history
    api.history.list(editingCase.id).then(setHistoryLogs);
  }, [editingCase, dentists]);

  // Recalculates default values based on selected services and elements
  const calculateDerivedValues = () => {
    let defaultEstHours = 0;
    let computedMatheusVal = 0;
    let computedPaschoalVal = 0;
    let computedTotalVal = 0;

    services.forEach(s => {
      // Find if selected
      const isSelected = caseServicesSelected[s.id]?.selected;
      if (isSelected) {
        const qty = caseServicesSelected[s.id]?.quantity || 1;
        const serviceValue = s.default_value;

        // Multiply by quantity if element-based
        const qtyMultiplier = s.billing_type === 'per_element' ? (teethSelection.teeth.length || 1) : 1;
        const lineTotal = serviceValue * qty * qtyMultiplier;

        defaultEstHours += s.default_estimated_time * qty * qtyMultiplier;
        computedTotalVal += lineTotal;

        if (s.enters_matheus_value) {
          computedMatheusVal += lineTotal;
        }
        if (s.enters_paschoal_value) {
          computedPaschoalVal += lineTotal;
        }
      }
    });

    return {
      estimated_hours: defaultEstHours,
      value_matheus: overrideValueMatheus === '' ? computedMatheusVal : parseFloat(overrideValueMatheus) || 0,
      value_planning: overrideValuePlanning === '' ? 0 : parseFloat(overrideValuePlanning) || 0,
      value_paschoal: overrideValuePaschoal === '' ? computedPaschoalVal : parseFloat(overrideValuePaschoal) || 0,
      total_value: computedTotalVal + (parseFloat(overrideValuePlanning) || 0)
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !selectedDentistId) return;

    try {
      const calculated = calculateDerivedValues();
      
      const payload: Case = {
        id: editingCase?.id || `CASE-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(cases.length + 1).padStart(4, '0')}`,
        dentist_id: selectedDentistId,
        patient_name: patientName,
        created_at: editingCase?.created_at || new Date().toISOString(),
        requested_delivery_date: requestedDeliveryDate,
        final_delivery_date: finalDeliveryDate || undefined,
        status: caseStatus,
        financial_status: financialStatus,
        teeth_selection: teethSelection,
        dentist_notes: dentistNotes,
        internal_notes: internalNotes,
        has_photo: hasPhoto,
        has_file: hasFile,
        estimated_hours: calculated.estimated_hours,
        value_matheus: calculated.value_matheus,
        value_planning: calculated.value_planning,
        value_paschoal: calculated.value_paschoal,
        cost_allan_matheus: parseFloat(costAllanMatheus) || 0,
        cost_allan_solo: parseFloat(costAllanSolo) || 0,
        cost_andrey: parseFloat(costAndrey) || 0,
        other_internal_costs: editingCase?.other_internal_costs || [],
        total_value: calculated.total_value,
        paid_value: parseFloat(paidValue) || 0,
        remaining_value: calculated.total_value - (parseFloat(paidValue) || 0),
        google_drive_folder_id: editingCase?.google_drive_folder_id || `folder-mock-${Date.now()}`,
        google_drive_folder_url: editingCase?.google_drive_folder_url || `https://drive.google.com/drive/folders/mock-${Date.now()}`,
        updated_at: new Date().toISOString()
      };

      await api.cases.save(payload, 'admin-1');
      setShowEditor(false);
      setEditingCase(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir permanentemente este caso?')) return;
    try {
      await api.cases.delete(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Status Badge coloring
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
      <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-full border ${styles[status]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Financial Status Badge coloring
  const getFinancialBadge = (status: FinancialStatus) => {
    const styles: Record<FinancialStatus, string> = {
      aguardando_pagamento: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      pago_parcial: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
      pago: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      isento: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      cancelado: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };
    return (
      <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-full border ${styles[status]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const filteredCases = cases.filter(c => {
    const dentist = dentists.find(d => d.id === c.dentist_id);
    const searchMatch = c.patient_name.toLowerCase().includes(search.toLowerCase()) || 
      (dentist?.full_name.toLowerCase().includes(search.toLowerCase()) ?? false) || 
      c.id.toLowerCase().includes(search.toLowerCase());
    
    const statusMatch = statusFilter === 'todos' || c.status === statusFilter;
    const dentistMatch = dentistFilter === 'todos' || c.dentist_id === dentistFilter;

    return searchMatch && statusMatch && dentistMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Trabalhos / Casos</h2>
          <p className="text-muted-foreground text-sm">
            Acompanhe o andamento dos modelos, prazos de entrega e pendências de faturamento.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCase(null);
            setShowEditor(true);
            setActiveEditorTab('info');
          }}
          className="glow-btn bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 text-sm"
        >
          <Plus size={18} />
          Cadastrar Novo Trabalho
        </button>
      </div>

      {/* Editor Modal Overlay */}
      {showEditor && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex justify-end animate-fade-in">
          <div className="w-full max-w-4xl bg-card border-l border-white/10 h-screen overflow-y-auto p-6 md:p-8 flex flex-col justify-between shadow-2xl relative">
            <button
              onClick={() => {
                setShowEditor(false);
                setEditingCase(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-all"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold mb-1">
                  {editingCase ? `Editar Trabalho - ${editingCase.id}` : 'Cadastrar Trabalho'}
                </h3>
                <p className="text-xs text-muted-foreground mb-6">
                  Preencha as informações clínicas, dentes selecionados e custos associados.
                </p>

                {/* Editor Tabs */}
                <div className="flex border-b border-white/5 mb-6 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab('info')}
                    className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
                      activeEditorTab === 'info'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Clínico & Odontograma
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab('financial')}
                    className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
                      activeEditorTab === 'financial'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Financeiro & Custos
                  </button>
                  {editingCase && (
                    <button
                      type="button"
                      onClick={() => setActiveEditorTab('history')}
                      className={`pb-2.5 text-sm font-semibold border-b-2 transition-all ${
                        activeEditorTab === 'history'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Auditoria
                    </button>
                  )}
                </div>

                {/* TAB 1: Clinical Info & Odontogram */}
                {activeEditorTab === 'info' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Dentista Requisitante
                        </label>
                        <select
                          value={selectedDentistId}
                          onChange={(e) => setSelectedDentistId(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm font-semibold"
                        >
                          {dentists.map(d => (
                            <option key={d.id} value={d.id}>{d.full_name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Nome do Paciente
                        </label>
                        <input
                          type="text"
                          required
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="Ex: João da Silva"
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Data Limite Solicitada
                        </label>
                        <input
                          type="date"
                          required
                          value={requestedDeliveryDate}
                          onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Prazo Final de Entrega (Dr. Matheus)
                        </label>
                        <input
                          type="date"
                          value={finalDeliveryDate}
                          onChange={(e) => setFinalDeliveryDate(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Status do Caso
                        </label>
                        <select
                          value={caseStatus}
                          onChange={(e: any) => setCaseStatus(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm font-semibold"
                        >
                          <option value="recebido">Recebido</option>
                          <option value="em_analise">Em Análise</option>
                          <option value="aguardando_aprovacao">Aguardando Aprovação</option>
                          <option value="aguardando_arquivos">Aguardando Arquivos</option>
                          <option value="em_execucao">Em Execução</option>
                          <option value="finalizado">Finalizado</option>
                          <option value="entregue">Entregue</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-6 bg-secondary/20 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="photo_check"
                            checked={hasPhoto}
                            onChange={(e) => setHasPhoto(e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                          />
                          <label htmlFor="photo_check" className="text-xs font-semibold text-foreground cursor-pointer">
                            Enviou Foto?
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="file_check"
                            checked={hasFile}
                            onChange={(e) => setHasFile(e.target.checked)}
                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                          />
                          <label htmlFor="file_check" className="text-xs font-semibold text-foreground cursor-pointer">
                            Enviou Arquivo?
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Odontogram selector */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Odontograma FDI
                      </label>
                      <Odontogram value={teethSelection} onChange={setTeethSelection} />
                    </div>

                    {/* Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Observações do Dentista
                        </label>
                        <textarea
                          rows={3}
                          value={dentistNotes}
                          onChange={(e) => setDentistNotes(e.target.value)}
                          placeholder="Recomendações clínicas ou solicitações do dentista parceiro..."
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Observação Interna (Apenas Admin)
                        </label>
                        <textarea
                          rows={3}
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          placeholder="Anotações internas, cronogramas de confecção ou notas laboratoriais..."
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm"
                        />
                      </div>
                    </div>

                    {/* Services Selector Checklist */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Procedimentos / Serviços
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-secondary/10 p-4 rounded-xl border border-white/5">
                        {services.map(s => {
                          const isSelected = caseServicesSelected[s.id]?.selected || false;
                          const qty = caseServicesSelected[s.id]?.quantity || 1;
                          return (
                            <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-card border border-white/5 hover:bg-secondary/40 transition-all">
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  id={`serv-${s.id}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    setCaseServicesSelected({
                                      ...caseServicesSelected,
                                      [s.id]: { selected: e.target.checked, quantity: qty }
                                    });
                                  }}
                                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                                />
                                <label htmlFor={`serv-${s.id}`} className="text-xs font-semibold text-foreground cursor-pointer">
                                  {s.name}
                                </label>
                              </div>
                              {isSelected && (
                                <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-lg border border-white/5">
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Qtd:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={(e) => {
                                      setCaseServicesSelected({
                                        ...caseServicesSelected,
                                        [s.id]: { selected: true, quantity: Math.max(1, parseInt(e.target.value) || 1) }
                                      });
                                    }}
                                    className="w-10 bg-transparent border-none text-center text-xs font-bold text-foreground focus:outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 2: Financial & Costs */}
                {activeEditorTab === 'financial' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Status Financeiro
                        </label>
                        <select
                          value={financialStatus}
                          onChange={(e: any) => setFinancialStatus(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm font-semibold"
                        >
                          <option value="aguardando_pagamento">Aguardando Pagamento</option>
                          <option value="pago_parcial">Pago Parcial</option>
                          <option value="pago">Pago</option>
                          <option value="isento">Isento</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Valor Pago (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={paidValue}
                          onChange={(e) => setPaidValue(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm font-semibold"
                        />
                      </div>
                    </div>

                    <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 space-y-4">
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary">Preços & Comissões Laboratoriais (Substitui automático se preenchido)</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Valor Matheus (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Deixar vazio para cálculo automático"
                            value={overrideValueMatheus}
                            onChange={(e) => setOverrideValueMatheus(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-card border border-white/10 text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Valor Planning (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 100.00"
                            value={overrideValuePlanning}
                            onChange={(e) => setOverrideValuePlanning(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-card border border-white/10 text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Valor Paschoal (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Deixar vazio para cálculo automático"
                            value={overrideValuePaschoal}
                            onChange={(e) => setOverrideValuePaschoal(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-card border border-white/10 text-sm font-semibold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 space-y-4">
                      <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary">Custos Internos / Subcontratações</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Allan/Matheus (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={costAllanMatheus}
                            onChange={(e) => setCostAllanMatheus(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-card border border-white/10 text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Allan Solo (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={costAllanSolo}
                            onChange={(e) => setCostAllanSolo(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-card border border-white/10 text-sm font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Andrey (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={costAndrey}
                            onChange={(e) => setCostAndrey(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-card border border-white/10 text-sm font-semibold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Drive Integration View */}
                    <div className="bg-secondary/10 p-5 rounded-2xl border border-dashed border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold">Pasta do Caso no Google Drive</h4>
                          <p className="text-xs text-muted-foreground">Estrutura automatizada de armazenamento na nuvem.</p>
                        </div>
                        <span className="p-2 rounded-xl bg-primary/10 text-primary">
                          <FolderOpen size={20} />
                        </span>
                      </div>
                      
                      {editingCase?.google_drive_folder_url ? (
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <a
                            href={editingCase.google_drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-center rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            Abrir Pasta no Drive
                          </a>
                          <button
                            type="button"
                            className="flex-1 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-white/10 text-center rounded-xl text-xs font-semibold transition-all"
                          >
                            Sincronizar Arquivos
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground font-semibold">
                          * A pasta será criada automaticamente após salvar e o login do Google Drive estiver conectado nas configurações.
                        </p>
                      )}
                    </div>

                  </div>
                )}

                {/* TAB 3: Audit history logs */}
                {activeEditorTab === 'history' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <History size={14} />
                      Log de Auditoria
                    </h4>
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                      {historyLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-xs">
                          Nenhum registro de auditoria disponível para este caso.
                        </div>
                      ) : (
                        historyLogs.map(log => (
                          <div key={log.id} className="p-3 rounded-xl bg-secondary/40 border border-white/5 space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-foreground">{log.user_name}</span>
                              <span className="text-muted-foreground text-[10px]">
                                {new Date(log.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              Ação realizada: <strong className="text-primary">{log.action === 'create' ? 'Criação' : 'Edição'}</strong>
                            </div>
                            {log.previous_data && (
                              <div className="mt-2 text-[10px] bg-secondary/80 p-2 rounded-lg text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                                Modificado de: {log.previous_data.status} para {log.new_data?.status}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Editor bottom bar */}
              <div className="flex justify-between items-center pt-6 border-t border-white/10 mt-8">
                {editingCase ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingCase.id)}
                    className="p-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive flex items-center justify-center gap-1.5 transition-all text-xs font-bold"
                  >
                    <Trash2 size={16} />
                    Excluir Caso
                  </button>
                ) : <div />}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditor(false);
                      setEditingCase(null);
                    }}
                    className="px-5 py-3 rounded-xl text-sm font-semibold hover:bg-secondary transition-all"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="glow-btn bg-primary hover:bg-primary/95 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all"
                  >
                    {editingCase ? 'Salvar Alterações' : 'Criar Caso'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advanced Filters */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por paciente, dente ou ID..."
            className="w-full pl-9 pr-3 py-2 bg-secondary/40 border border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-secondary/40 border border-white/10 text-xs font-semibold"
            >
              <option value="todos">Todos os Status</option>
              <option value="recebido">Recebido</option>
              <option value="em_analise">Em Análise</option>
              <option value="aguardando_aprovacao">Aguardando Aprovação</option>
              <option value="aguardando_arquivos">Aguardando Arquivos</option>
              <option value="em_execucao">Em Execução</option>
              <option value="finalizado">Finalizado</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Dentist Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline">Dentista:</span>
            <select
              value={dentistFilter}
              onChange={(e) => setDentistFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-secondary/40 border border-white/10 text-xs font-semibold w-full sm:w-44"
            >
              <option value="todos">Todos os Dentistas</option>
              {dentists.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* Main Cases Table (desktop) / Cards (mobile) */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando lista de casos...</div>
      ) : (
        <div className="space-y-4">
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-white/5 glass-panel">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 border-b border-white/10">
                <tr>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">ID do Caso</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Dentista</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Paciente</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Status Clínico</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Status Financeiro</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] text-center">Entrega Final</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] text-right">Valor Total</th>
                  <th className="p-4 font-bold text-muted-foreground uppercase tracking-widest text-[9px] text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      Nenhum caso cadastrado correspondente aos filtros.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map(c => {
                    const dentist = dentists.find(d => d.id === c.dentist_id);
                    return (
                      <tr key={c.id} className="hover:bg-secondary/20 transition-all duration-200">
                        <td className="p-4 font-bold text-foreground">{c.id}</td>
                        <td className="p-4 font-semibold">{dentist?.full_name || 'Desconhecido'}</td>
                        <td className="p-4 font-semibold text-foreground">{c.patient_name}</td>
                        <td className="p-4">{getStatusBadge(c.status)}</td>
                        <td className="p-4">{getFinancialBadge(c.financial_status)}</td>
                        <td className="p-4 text-center font-bold text-muted-foreground">
                          {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                        </td>
                        <td className="p-4 text-right font-bold text-foreground">
                          R$ {c.total_value.toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingCase(c);
                                setShowEditor(true);
                              }}
                              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                            >
                              <Edit2 size={13} />
                            </button>
                            {c.google_drive_folder_url && (
                              <a
                                href={c.google_drive_folder_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-all"
                              >
                                <FolderOpen size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            {filteredCases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs col-span-full border border-dashed border-white/5 rounded-2xl bg-card">
                Nenhum caso cadastrado correspondente aos filtros.
              </div>
            ) : (
              filteredCases.map(c => {
                const dentist = dentists.find(d => d.id === c.dentist_id);
                return (
                  <div key={c.id} className="glass-panel p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold">{c.id}</span>
                        <h4 className="font-bold text-base text-foreground leading-snug">{c.patient_name}</h4>
                        <p className="text-xs font-semibold text-primary">{dentist?.full_name || 'Desconhecido'}</p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingCase(c);
                          setShowEditor(true);
                        }}
                        className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-3 border-t border-b border-white/5">
                      <div>
                        <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Status</span>
                        {getStatusBadge(c.status)}
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Financeiro</span>
                        {getFinancialBadge(c.financial_status)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar size={13} />
                        Fim: {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                      </span>
                      <span className="text-foreground font-bold text-sm">
                        R$ {c.total_value.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
};
