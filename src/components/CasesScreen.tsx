import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, Profile, Service, CaseStatus, FinancialStatus, OdontogramSelection, CaseHistory } from '../types';
import { Odontogram } from './Odontogram';
import { 
  Search, Plus, Edit2, Trash2, Calendar, 
  X, FolderOpen, History, ChevronLeft, ChevronRight 
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
  const [overrideValuePaschoal, setOverrideValuePaschoal] = useState('');
  const [costAndrey, setCostAndrey] = useState('');
  const [costAndreyDiscounted, setCostAndreyDiscounted] = useState(false);
  const [dynamicCosts, setDynamicCosts] = useState<{ name: string; value: number }[]>([]);
  const [paidValue, setPaidValue] = useState('');
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'date-asc' | 'id-desc' | 'id-asc'>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCurrentPage(1);
    setSelectedCaseIds({});
  }, [search, statusFilter, dentistFilter, sortOrder]);

  const handleToggleSelect = (caseId: string) => {
    setSelectedCaseIds(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Object.keys(selectedCaseIds).filter(id => selectedCaseIds[id]);
    if (idsToDelete.length === 0) return;

    if (!window.confirm(`Tem certeza que deseja excluir permanentemente estes ${idsToDelete.length} casos selecionados?`)) {
      return;
    }

    try {
      setLoading(true);
      for (const id of idsToDelete) {
        await api.cases.delete(id);
      }
      setSelectedCaseIds({});
      setCurrentPage(1);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir os casos selecionados.');
    } finally {
      setLoading(false);
    }
  };

  // History log
  const [historyLogs, setHistoryLogs] = useState<CaseHistory[]>([]);

  // File Upload states
  const [photoFiles, setPhotoFiles] = useState<{ name: string; size: number }[]>([]);
  const [scanFiles, setScanFiles] = useState<{ name: string; size: number }[]>([]);

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
      setOverrideValuePaschoal('');
      setCostAndrey('0');
      setCostAndreyDiscounted(false);
      setDynamicCosts([]);
      setPaidValue('0');
      setCaseServicesSelected({});
      setHistoryLogs([]);
      setPhotoFiles([]);
      setScanFiles([]);
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
    setPhotoFiles([]);
    setScanFiles([]);

    // Populate selected services
    const servicesMap: Record<string, { selected: boolean; quantity: number }> = {};
    if (editingCase.selected_services) {
      editingCase.selected_services.forEach(id => {
        servicesMap[id] = { selected: true, quantity: 1 };
      });
    } else {
      // Fallback match by value or if we don't have selected_services
      const matched = services.find(s => s.default_value === editingCase.total_value);
      if (matched) {
        servicesMap[matched.id] = { selected: true, quantity: 1 };
      }
    }
    setCaseServicesSelected(servicesMap);

    // Overrides
    setOverrideValueMatheus(editingCase.value_matheus === 0 ? '' : String(editingCase.value_matheus));
    setOverrideValuePaschoal(editingCase.value_paschoal === 0 ? '' : String(editingCase.value_paschoal));
    setCostAndrey(String(editingCase.cost_andrey));
    setCostAndreyDiscounted(!!editingCase.cost_andrey_discounted);
    setDynamicCosts(editingCase.other_internal_costs || []);
    setPaidValue(String(editingCase.paid_value));

    // Retrieve history
    api.history.list(editingCase.id).then(setHistoryLogs);
  }, [editingCase, dentists, services]);

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

    const matheusVal = overrideValueMatheus === '' ? computedMatheusVal : parseFloat(overrideValueMatheus) || 0;
    const paschoalVal = overrideValuePaschoal === '' ? computedPaschoalVal : parseFloat(overrideValuePaschoal) || 0;

    return {
      estimated_hours: defaultEstHours,
      value_matheus: matheusVal,
      value_planning: 0,
      value_paschoal: paschoalVal,
      total_value: overrideValueMatheus === '' && overrideValuePaschoal === '' ? computedTotalVal : (matheusVal + paschoalVal)
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !selectedDentistId) return;

    try {
      const calculated = calculateDerivedValues();
      const caseId = editingCase?.id || `CASE-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(cases.length + 1).padStart(4, '0')}`;
      
      const driveFolderUrl = `https://drive.google.com/drive/folders/1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN?usp=sharing`;

      const payload: Case = {
        id: caseId,
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
        has_photo: hasPhoto || photoFiles.length > 0,
        has_file: hasFile || scanFiles.length > 0,
        estimated_hours: calculated.estimated_hours,
        value_matheus: calculated.value_matheus,
        value_planning: 0,
        value_paschoal: calculated.value_paschoal,
        cost_allan_matheus: 0,
        cost_allan_solo: 0,
        cost_andrey: parseFloat(costAndrey) || 0,
        cost_andrey_discounted: costAndreyDiscounted,
        other_internal_costs: dynamicCosts.filter(c => c.name.trim() !== ''),
        total_value: calculated.total_value,
        paid_value: parseFloat(paidValue) || 0,
        remaining_value: calculated.total_value - (parseFloat(paidValue) || 0),
        google_drive_folder_id: editingCase?.google_drive_folder_id || `folder-mock-${Date.now()}`,
        google_drive_folder_url: editingCase?.google_drive_folder_url || driveFolderUrl,
        selected_services: Object.keys(caseServicesSelected).filter(id => caseServicesSelected[id]?.selected),
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

  const sortedCases = [...filteredCases].sort((a, b) => {
    if (sortOrder === 'date-desc') {
      return b.created_at.localeCompare(a.created_at);
    }
    if (sortOrder === 'date-asc') {
      return a.created_at.localeCompare(b.created_at);
    }
    if (sortOrder === 'id-desc') {
      return b.id.localeCompare(a.id);
    }
    if (sortOrder === 'id-asc') {
      return a.id.localeCompare(b.id);
    }
    return 0;
  });

  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(sortedCases.length / itemsPerPage));
  const paginatedCases = sortedCases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const isAllSelectedOnPage = paginatedCases.length > 0 && paginatedCases.every(c => selectedCaseIds[c.id]);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = currentPage - 2;
      let end = currentPage + 2;
      
      if (start < 1) {
        end = end + (1 - start);
        start = 1;
      }
      if (end > totalPages) {
        start = start - (end - totalPages);
        end = totalPages;
      }
      
      start = Math.max(1, start);
      end = Math.min(totalPages, end);
      
      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push('... ');
        }
      }
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i);
        } else if (i === 1 && !pages.includes(1)) {
          pages.push(1);
        }
      }
      
      if (end < totalPages) {
        if (end < totalPages - 1) {
          pages.push(' ...');
        }
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const handleToggleSelectAllOnPage = () => {
    if (isAllSelectedOnPage) {
      const nextSelection = { ...selectedCaseIds };
      paginatedCases.forEach(c => {
        delete nextSelection[c.id];
      });
      setSelectedCaseIds(nextSelection);
    } else {
      const nextSelection = { ...selectedCaseIds };
      paginatedCases.forEach(c => {
        nextSelection[c.id] = true;
      });
      setSelectedCaseIds(nextSelection);
    }
  };

  const selectedCount = Object.keys(selectedCaseIds).filter(id => selectedCaseIds[id]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Trabalhos / Casos</h2>
          <p className="text-slate-500 text-xs mt-1">
            Acompanhe o andamento dos modelos, prazos de entrega e pendências de faturamento.
          </p>
        </div>
        <div className="flex gap-2.5">
          {selectedCount > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm animate-fade-in"
            >
              <Trash2 size={14} />
              Excluir Selecionados ({selectedCount})
            </button>
          )}
          <button
            onClick={() => {
              setEditingCase(null);
              setShowEditor(true);
              setActiveEditorTab('info');
            }}
            className="bg-[#0F766E] hover:bg-[#0F766E]/90 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            Cadastrar Novo Trabalho
          </button>
        </div>
      </div>
      {/* Editor Modal Overlay */}
      {showEditor && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex justify-end animate-fade-in">
          <div className="w-full max-w-5xl bg-white border-l border-[#E2E8F0] h-screen overflow-y-auto p-6 md:p-8 flex flex-col justify-between shadow-2xl relative text-slate-900">
            <button
              onClick={() => {
                setShowEditor(false);
                setEditingCase(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {editingCase ? `Editar Trabalho - ${editingCase.id}` : 'Cadastrar Trabalho'}
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  Preencha as informações clínicas, dentes selecionados e custos associados.
                </p>

                {/* Editor Tabs */}
                <div className="flex border-b border-[#E2E8F0] mb-6 gap-6 pb-px">
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab('info')}
                    className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                      activeEditorTab === 'info'
                        ? 'border-[#0F766E] text-[#0F766E]'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Clínico & Odontograma
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab('financial')}
                    className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                      activeEditorTab === 'financial'
                        ? 'border-[#0F766E] text-[#0F766E]'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Financeiro & Custos
                  </button>
                  {editingCase && (
                    <button
                      type="button"
                      onClick={() => setActiveEditorTab('history')}
                      className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                        activeEditorTab === 'history'
                          ? 'border-[#0F766E] text-[#0F766E]'
                          : 'border-transparent text-slate-500 hover:text-slate-900'
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
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Dentista Requisitante
                        </label>
                        <select
                          value={selectedDentistId}
                          onChange={(e) => setSelectedDentistId(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] transition-all"
                        >
                          {dentists.map(d => (
                            <option key={d.id} value={d.id}>{d.full_name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Nome do Paciente
                        </label>
                        <input
                          type="text"
                          required
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="Ex: João da Silva"
                          className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Data Limite Solicitada
                        </label>
                        <input
                          type="date"
                          required
                          value={requestedDeliveryDate}
                          onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Prazo Final de Entrega (Dr. Matheus)
                        </label>
                        <input
                          type="date"
                          value={finalDeliveryDate}
                          onChange={(e) => setFinalDeliveryDate(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Status do Caso
                        </label>
                        <select
                          value={caseStatus}
                          onChange={(e: any) => setCaseStatus(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] transition-all"
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

                      <div className="space-y-4 col-span-full">
                        <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#166534] font-medium flex items-center gap-2">
                          <FolderOpen size={16} className="text-[#0F766E] shrink-0" />
                          <span>
                            Os arquivos enviados serão salvos na pasta correspondente no Google Drive: <strong>Fotos</strong> para imagens e <strong>Escaneamento</strong> para arquivos 3D.
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Fotos Clínicas zone */}
                          <div className="p-4 rounded-lg border border-dashed border-[#E2E8F0] bg-slate-50 space-y-3">
                            <div className="flex items-center gap-2 text-[#0F766E] font-bold text-[10px] uppercase tracking-wider">
                              <FolderOpen size={14} />
                              Enviar Fotos Clínicas
                            </div>
                            <p className="text-[10px] text-slate-400">Arraste ou clique para enviar fotos clínicas (JPG, PNG).</p>
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
                              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-200 file:text-[10px] file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 file:cursor-pointer"
                            />
                            {photoFiles.length > 0 && (
                              <div className="space-y-1 pt-1.5">
                                {photoFiles.map((f, i) => (
                                  <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg text-[10px] border border-[#E2E8F0]">
                                    <span className="truncate max-w-[150px] text-slate-800 font-semibold">{f.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = photoFiles.filter((_, idx) => idx !== i);
                                        setPhotoFiles(updated);
                                        if (updated.length === 0) setHasPhoto(false);
                                      }}
                                      className="text-rose-600 hover:text-rose-700 font-semibold px-1.5 cursor-pointer"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Escaneamentos 3D zone */}
                          <div className="p-4 rounded-lg border border-dashed border-[#E2E8F0] bg-slate-50 space-y-3">
                            <div className="flex items-center gap-2 text-[#0F766E] font-bold text-[10px] uppercase tracking-wider">
                              <FolderOpen size={14} />
                              Enviar Escaneamento (3D)
                            </div>
                            <p className="text-[10px] text-slate-400">Arraste ou clique para enviar escaneamentos (STL, OBJ, ZIP).</p>
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
                              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-200 file:text-[10px] file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 file:cursor-pointer"
                            />
                            {scanFiles.length > 0 && (
                              <div className="space-y-1 pt-1.5">
                                {scanFiles.map((f, i) => (
                                  <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg text-[10px] border border-[#E2E8F0]">
                                    <span className="truncate max-w-[150px] text-slate-800 font-semibold">{f.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = scanFiles.filter((_, idx) => idx !== i);
                                        setScanFiles(updated);
                                        if (updated.length === 0) setHasFile(false);
                                      }}
                                      className="text-rose-600 hover:text-rose-700 font-semibold px-1.5 cursor-pointer"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Odontogram selector */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                        Selecione os elementos no Odontograma FDI
                      </label>
                      <Odontogram value={teethSelection} onChange={setTeethSelection} />
                    </div>

                    {/* Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Observações do Dentista
                        </label>
                        <textarea
                          rows={3}
                          value={dentistNotes}
                          onChange={(e) => setDentistNotes(e.target.value)}
                          placeholder="Recomendações clínicas ou solicitações do dentista parceiro..."
                          className="w-full px-3.5 py-2.5 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] text-xs font-medium focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Observação Interna (Apenas Admin)
                        </label>
                        <textarea
                          rows={3}
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          placeholder="Anotações internas, cronogramas de confecção ou notas laboratoriais..."
                          className="w-full px-3.5 py-2.5 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] text-xs font-medium focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                        />
                      </div>
                    </div>

                    {/* Services Selector Checklist */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                        Procedimentos / Serviços
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-[#E2E8F0]">
                        {services.map(s => {
                          const isSelected = caseServicesSelected[s.id]?.selected || false;
                          const qty = caseServicesSelected[s.id]?.quantity || 1;
                          return (
                            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-all">
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
                                  className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                                />
                                <label htmlFor={`serv-${s.id}`} className="text-xs font-medium text-slate-700 cursor-pointer">
                                  {s.name}
                                </label>
                              </div>
                              {isSelected && (
                                <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-[#E2E8F0]">
                                  <span className="text-[10px] text-slate-400 uppercase font-bold">Qtd:</span>
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
                                    className="w-10 bg-transparent border-none text-center text-xs font-bold text-slate-900 focus:outline-none"
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
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Status Financeiro
                        </label>
                        <select
                          value={financialStatus}
                          onChange={(e: any) => setFinancialStatus(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] transition-all"
                        >
                          <option value="aguardando_pagamento">Aguardando Pagamento</option>
                          <option value="pago_parcial">Pago Parcial</option>
                          <option value="pago">Pago</option>
                          <option value="isento">Isento</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                          Valor Pago (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={paidValue}
                          onChange={(e) => setPaidValue(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] transition-all"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-[#E2E8F0] space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">Preços & Comissões Laboratoriais (Substitui automático se preenchido)</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                            Valor Matheus (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Deixar vazio para cálculo automático"
                            value={overrideValueMatheus}
                            onChange={(e) => setOverrideValueMatheus(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                            Valor Paschoal (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Deixar vazio para cálculo automático"
                            value={overrideValuePaschoal}
                            onChange={(e) => setOverrideValuePaschoal(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-[#E2E8F0] space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">Custos Internos / Subcontratações</h4>
                        <button
                          type="button"
                          onClick={() => setDynamicCosts([...dynamicCosts, { name: '', value: 0 }])}
                          className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          + Adicionar Custo
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Fixed Cost: Andrey */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-white p-3 rounded-xl border border-[#E2E8F0]">
                          <div className="text-xs font-semibold text-slate-700">
                            Dr. Andrey (Fixo)
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Valor (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={costAndrey}
                              onChange={(e) => setCostAndrey(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-right"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-4">
                            <input
                              type="checkbox"
                              id="andrey_discounted"
                              checked={costAndreyDiscounted}
                              onChange={(e) => setCostAndreyDiscounted(e.target.checked)}
                              className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                            />
                            <label htmlFor="andrey_discounted" className="text-[10px] font-semibold text-slate-500 cursor-pointer">
                              Descontado de Dr. Andrey?
                            </label>
                          </div>
                        </div>

                        {/* Dynamic Costs */}
                        {dynamicCosts.map((cost, idx) => (
                          <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-3 rounded-xl border border-[#E2E8F0]">
                            <div className="sm:col-span-6">
                              <label className="block text-[10px] text-slate-400 mb-1">Descrição / Nome do Custo</label>
                              <input
                                type="text"
                                value={cost.name}
                                placeholder="Ex: Terceirizado X"
                                onChange={(e) => {
                                  const updated = [...dynamicCosts];
                                  updated[idx].name = e.target.value;
                                  setDynamicCosts(updated);
                                }}
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] text-slate-400 mb-1">Valor (R$)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={cost.value || ''}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const updated = [...dynamicCosts];
                                  updated[idx].value = parseFloat(e.target.value) || 0;
                                  setDynamicCosts(updated);
                                }}
                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-right"
                              />
                            </div>
                            <div className="sm:col-span-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = dynamicCosts.filter((_, i) => i !== idx);
                                  setDynamicCosts(updated);
                                }}
                                className="p-2 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all text-xs font-bold cursor-pointer"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Drive Integration View */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-dashed border-[#E2E8F0] space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Pasta do Caso no Google Drive</h4>
                          <p className="text-[11px] text-slate-500">Estrutura automatizada de armazenamento na nuvem.</p>
                        </div>
                        <span className="p-2 rounded-xl bg-teal-50 border border-teal-100 text-[#0F766E]">
                          <FolderOpen size={20} />
                        </span>
                      </div>
                      
                      {editingCase?.google_drive_folder_url ? (
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <a
                            href={editingCase.google_drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2.5 bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 text-center rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            Abrir Pasta no Drive
                          </a>
                          <button
                            type="button"
                            className="flex-1 py-2.5 bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 text-center rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          >
                            Sincronizar Arquivos
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-semibold">
                          * A pasta será criada automaticamente após salvar e o login do Google Drive estiver conectado nas configurações.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: Audit history logs */}
                {activeEditorTab === 'history' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F766E] flex items-center gap-1.5">
                      <History size={14} />
                      Log de Auditoria
                    </h4>
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
                      {historyLogs.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-xs">
                          Nenhum registro de auditoria disponível para este caso.
                        </div>
                      ) : (
                        historyLogs.map(log => (
                          <div key={log.id} className="p-3 rounded-xl bg-white border border-[#E2E8F0] space-y-1.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-900">{log.user_name}</span>
                              <span className="text-slate-400 text-[10px]">
                                {new Date(log.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="text-slate-500">
                              Ação realizada: <strong className="text-[#0F766E]">{log.action === 'create' ? 'Criação' : 'Edição'}</strong>
                            </div>
                            {log.previous_data && (
                              <div className="mt-2 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-[#E2E8F0] text-slate-500 overflow-x-auto whitespace-pre-wrap font-mono">
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
              <div className="flex justify-between items-center pt-6 border-t border-[#E2E8F0] mt-8">
                {editingCase ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingCase.id)}
                    className="p-2.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer"
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
                    className="px-4 py-2 bg-white border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer"
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
      <div className="glass-panel p-4 rounded-xl border border-[#E2E8F0] flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] pointer-events-none">
            <Search size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por paciente, dente ou ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] text-[#0F172A] placeholder:text-[#94A3B8]"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-[11px] font-medium text-[#64748B] hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
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
            <span className="text-[11px] font-medium text-[#64748B] hidden sm:inline">Dentista:</span>
            <select
              value={dentistFilter}
              onChange={(e) => setDentistFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0F766E] w-full sm:w-40"
            >
              <option value="todos">Todos os Dentistas</option>
              {dentists.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          {/* Order Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-[11px] font-medium text-[#64748B] hidden sm:inline">Ordenação:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            >
              <option value="date-desc">Data (Mais recente)</option>
              <option value="date-asc">Data (Mais antiga)</option>
              <option value="id-desc">ID do Caso (Z-A)</option>
              <option value="id-asc">ID do Caso (A-Z)</option>
            </select>
          </div>
        </div>

      </div>

      {/* Main Cases Table (desktop) / Cards (mobile) */}
      {loading ? (
        <div className="text-center py-12 text-[#64748B] text-sm font-medium">Carregando lista de casos...</div>
      ) : (
        <div className="space-y-4">
          {/* Banner de Seleção Lote de todas as páginas */}
          {isAllSelectedOnPage && filteredCases.length > paginatedCases.length && (
            <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-xs text-[#0F766E] font-medium flex items-center justify-between animate-fade-in shadow-sm">
              <span>
                Todos os <strong>{paginatedCases.length}</strong> casos desta página estão selecionados.
              </span>
              {selectedCount < filteredCases.length ? (
                <button
                  type="button"
                  onClick={() => {
                    const allIds: Record<string, boolean> = {};
                    filteredCases.forEach(c => {
                      allIds[c.id] = true;
                    });
                    setSelectedCaseIds(allIds);
                  }}
                  className="underline hover:text-[#115E59] font-bold cursor-pointer bg-transparent border-none p-0"
                >
                  Selecionar todos os {filteredCases.length} casos correspondentes aos filtros.
                </button>
              ) : (
                <div className="flex gap-2">
                  <span>Todos os <strong>{filteredCases.length}</strong> casos correspondentes aos filtros foram selecionados.</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCaseIds({})}
                    className="underline hover:text-[#115E59] font-bold cursor-pointer bg-transparent border-none p-0"
                  >
                    Limpar seleção
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelectedOnPage}
                      onChange={handleToggleSelectAllOnPage}
                      className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                    />
                  </th>
                  <th className="p-3.5">ID do Caso</th>
                  <th className="p-3.5">Dentista</th>
                  <th className="p-3.5">Paciente</th>
                  <th className="p-3.5">Status Clínico</th>
                  <th className="p-3.5">Status Financeiro</th>
                  <th className="p-3.5 text-center">Entrega Final</th>
                  <th className="p-3.5 text-right">Valor Total</th>
                  <th className="p-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {paginatedCases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#64748B] text-xs">
                      Nenhum caso cadastrado correspondente aos filtros.
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map(c => {
                    const dentist = dentists.find(d => d.id === c.dentist_id);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-all duration-150">
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={!!selectedCaseIds[c.id]}
                            onChange={() => handleToggleSelect(c.id)}
                            className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                          />
                        </td>
                        <td className="p-3.5 font-semibold text-slate-800 font-mono text-[11px]">{c.id}</td>
                        <td className="p-3.5 text-slate-600 font-medium">{dentist?.full_name || 'Desconhecido'}</td>
                        <td className="p-3.5 font-bold text-[#0F172A]">{c.patient_name}</td>
                        <td className="p-3.5">{getStatusBadge(c.status)}</td>
                        <td className="p-3.5">{getFinancialBadge(c.financial_status)}</td>
                        <td className="p-3.5 text-center font-medium text-slate-600">
                          {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                        </td>
                        <td className="p-3.5 text-right font-bold text-[#0F172A]">
                          R$ {c.total_value.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCase(c);
                                setShowEditor(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-50 border border-[#E2E8F0] text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                            {c.google_drive_folder_url && (
                              <a
                                href={c.google_drive_folder_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-slate-50 border border-[#E2E8F0] text-slate-600 hover:text-[#0F766E] transition-all cursor-pointer"
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
            {paginatedCases.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs col-span-full border border-dashed border-[#E2E8F0] rounded-xl bg-white">
                Nenhum caso cadastrado correspondente aos filtros.
              </div>
            ) : (
              paginatedCases.map(c => {
                const dentist = dentists.find(d => d.id === c.dentist_id);
                return (
                  <div key={c.id} className="glass-panel p-5 rounded-xl border border-[#E2E8F0] flex flex-col justify-between space-y-4 hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={!!selectedCaseIds[c.id]}
                          onChange={() => handleToggleSelect(c.id)}
                          className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300 mt-1"
                        />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold">{c.id}</span>
                          <h4 className="font-bold text-sm text-slate-900 leading-snug">{c.patient_name}</h4>
                          <p className="text-xs font-semibold text-[#0F766E]">{dentist?.full_name || 'Desconhecido'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCase(c);
                          setShowEditor(true);
                        }}
                        className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
 
                    <div className="grid grid-cols-2 gap-2 text-xs py-3 border-t border-b border-[#E2E8F0]">
                      <div>
                        <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Status</span>
                        {getStatusBadge(c.status)}
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Financeiro</span>
                        {getFinancialBadge(c.financial_status)}
                      </div>
                    </div>
 
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Calendar size={13} />
                        Fim: {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                      </span>
                      <span className="text-slate-900 font-bold text-sm">
                        R$ {c.total_value.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#E2E8F0] gap-4 text-xs font-medium text-slate-500">
              <div>
                Exibindo {Math.min(sortedCases.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(sortedCases.length, currentPage * itemsPerPage)} de {sortedCases.length} casos
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-2 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                  title="Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1.5">
                  {getPageNumbers().map((pageNum, idx) => {
                    if (typeof pageNum === 'string') {
                      return (
                        <span key={`ell-${idx}`} className="px-1 text-slate-400 font-semibold select-none">
                          {pageNum.trim()}
                        </span>
                      );
                    }
                    const isCurrent = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer font-bold ${
                          isCurrent
                            ? 'border-[#0F766E] bg-[#ECFDF5] text-[#0F766E]'
                            : 'border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
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
    </div>
  );
};
