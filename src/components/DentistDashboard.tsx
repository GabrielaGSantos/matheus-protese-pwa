import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import type { Case, Service, OdontogramSelection, CaseStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Odontogram } from './Odontogram';
import { 
  AlertCircle, AlertTriangle, DollarSign, 
  Clock, CheckCircle, FolderOpen, Send, Paperclip,
  Search, ChevronLeft, ChevronRight, X, FileText
} from 'lucide-react';
// Google Drive is now managed by the backend
import { notificationService } from '../services/notifications';
import { useRealtime } from '../hooks/useRealtime';
// @ts-ignore
const isDriveFolderValid = (c: Case) => {
  if (c.drive_status !== 'created' || !c.google_drive_folder_url) return false;
  const rootId = localStorage.getItem('google_drive_root_folder_id') || '1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN';
  try {
    const url = new URL(c.google_drive_folder_url);
    const pathParts = url.pathname.split('/');
    const folderIdIndex = pathParts.indexOf('folders');
    if (folderIdIndex !== -1 && pathParts[folderIdIndex + 1]) {
      const folderId = pathParts[folderIdIndex + 1].split('?')[0];
      if (folderId === rootId) {
        return false;
      }
    }
  } catch {
    if (c.google_drive_folder_url === rootId) return false;
  }
  return true;
};

interface DentistDashboardProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const DentistDashboard: React.FC<DentistDashboardProps> = ({ currentTab, setCurrentTab }) => {
  const { user, isAuxiliar, linkedDentistId } = useAuth();
  const activeDentistId = isAuxiliar ? linkedDentistId : user?.id;
  const [cases, setCases] = useState<Case[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [activeTab, setActiveTab] = useState<'my-cases' | 'new-case' | 'change-password'>(
    currentTab === 'dentist-new-case' ? 'new-case' : 'my-cases'
  );

  useEffect(() => {
    if (currentTab === 'dentist-new-case') {
      setActiveTab('new-case');
      setEditingCase(null);
      setPatientName('');
      setDentistNotes('');
      setTeethSelection({ teeth: [], type: 'individual' });
      setHasPhoto(false);
      setHasFile(false);
      setPhotoFiles([]);
      setScanFiles([]);
      setSelectedServices({});
      setRequestedDate('');
    } else if (currentTab === 'dentist-cases') {
      setActiveTab('my-cases');
      setEditingCase(null);
    }
  }, [currentTab]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [finalizedPage, setFinalizedPage] = useState(1);

  useEffect(() => {
    setFinalizedPage(1);
  }, [searchQuery]);
  
  // Change Password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  // New Case Form state
  const [patientName, setPatientName] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [dentistNotes, setDentistNotes] = useState('');
  const [teethSelection, setTeethSelection] = useState<OdontogramSelection>({ teeth: [], type: 'individual' });
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({});
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  // Editing state for Dentist
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [caseResults, setCaseResults] = useState<Record<string, any[]>>({});
  const [dentistFiles, setDentistFiles] = useState<Record<string, any[]>>({});
  const [viewingResultsFiles, setViewingResultsFiles] = useState<any[] | null>(null);

  useRealtime('cases', () => {
    fetchData();
  }, (payload) => {
    if (editingCase && payload.eventType === 'UPDATE' && payload.new.id === editingCase.id) {
      if (payload.new.updated_at && payload.new.updated_at !== editingCase.updated_at) {
        alert('Atenção: O laboratório acabou de atualizar o status deste caso! Feche e abra novamente para ver as informações mais recentes.');
      }
    }
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!activeDentistId) return;
    setLoading(true);
    try {
      const [cResult, sResult] = await Promise.allSettled([
        api.cases.list('dentist', activeDentistId),
        api.services.list()
      ]);

      const c = cResult.status === 'fulfilled' ? cResult.value : [];
      if (cResult.status === 'rejected') console.error('Erro casos:', cResult.reason);

      const s = sResult.status === 'fulfilled' ? sResult.value : [];
      if (sResult.status === 'rejected') console.error('Erro serviços:', sResult.reason);

      setCases(c);
      setServices(s);

      // Fetch result attachments
      const resultsMap: Record<string, any[]> = {};
      const dentistFilesMap: Record<string, any[]> = {};
      for (const caseItem of c) {
        try {
          const attachments = await api.attachments.list(caseItem.id);
          const results = attachments.filter(a => a.file_category === 'resultado' || a.file_category === 'enceramento_digital');
          const dFiles = attachments.filter(a => a.file_category === 'imagens' || a.file_category === 'escaneamento');
          if (results.length > 0) {
            resultsMap[caseItem.id] = results;
          }
          if (dFiles.length > 0) {
            dentistFilesMap[caseItem.id] = dFiles;
          }
        } catch (err) {
          console.error(`Erro ao carregar anexos para o caso ${caseItem.id}:`, err);
        }
      }
      setCaseResults(resultsMap);
      setDentistFiles(dentistFilesMap);

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

    if (!teethSelection || !teethSelection.teeth || teethSelection.teeth.length === 0) {
      alert('Por favor, selecione pelo menos um elemento (dente) no odontograma.');
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

      const caseId = editingCase?.id || `CASE-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(cases.length + 1).padStart(4, '0')}`;
      const dentistName = user?.full_name || 'Dentista';
      let driveStatus: 'not_created' | 'created' | 'error' = editingCase?.drive_status || 'not_created';
      let driveDentistFolderId = editingCase?.drive_dentist_folder_id;
      let driveCaseFolderId = editingCase?.drive_case_folder_id;
      let driveImagesFolderId = editingCase?.drive_images_folder_id;
      let driveScanFolderId = editingCase?.drive_scan_folder_id;
      let driveCaseFolderUrl = editingCase?.drive_case_folder_url;
      let driveErrorMessage = editingCase?.drive_error_message;

        const fallbackDentistId = activeDentistId || '';
        const payload: Case = {
          id: caseId,
          dentist_id: fallbackDentistId,
          patient_name: patientName,
          created_at: editingCase?.created_at || new Date().toISOString(),
          requested_delivery_date: requestedDate,
          final_delivery_date: editingCase?.final_delivery_date, 
          status: editingCase ? editingCase.status : ((photoFiles.length === 0 && !hasPhoto && scanFiles.length === 0 && !hasFile)
            ? 'aguardando_arquivos'
            : 'em_analise'),
          financial_status: editingCase?.financial_status || 'aguardando_pagamento',
          teeth_selection: teethSelection,
          dentist_notes: dentistNotes,
          has_photo: hasPhoto || photoFiles.length > 0,
          has_file: hasFile || scanFiles.length > 0,
          estimated_hours: totalEstHours,
          value_matheus: valMatheus,
          value_planning: 0,
          value_paschoal: valPaschoal,
          cost_allan_matheus: 0,
          cost_allan_solo: 0,
          cost_andrey: editingCase?.cost_andrey || 0,
          other_internal_costs: editingCase?.other_internal_costs || [],
          total_value: computedTotalValue,
          paid_value: editingCase?.paid_value || 0,
          remaining_value: computedTotalValue - (editingCase?.paid_value || 0),
          google_drive_folder_id: editingCase?.google_drive_folder_id || undefined,
          google_drive_folder_url: editingCase?.google_drive_folder_url || undefined,
          drive_status: driveStatus,
          drive_dentist_folder_id: driveDentistFolderId,
          drive_case_folder_id: driveCaseFolderId,
          drive_images_folder_id: driveImagesFolderId,
          drive_scan_folder_id: driveScanFolderId,
          drive_case_folder_url: driveCaseFolderUrl,
          drive_error_message: driveErrorMessage,
          financial_released: editingCase ? editingCase.financial_released : false,
          selected_services: selectedIds,
          updated_at: new Date().toISOString()
        };

        await api.cases.save(payload, fallbackDentistId);

        // Upload photos clinical to backend Google Drive integration
        let uploadError = false;
        for (const f of photoFiles) {
          try {
            await api.attachments.uploadFile(f, caseId, patientName, dentistName, 'imagens', fallbackDentistId);
            notificationService.add(
              'Novo Arquivo Enviado',
              `O dentista "${dentistName}" enviou a foto "${f.name}" para o caso ${caseId}.`,
              'file_uploaded',
              caseId
            );
          } catch (err: any) {
            console.error('Erro ao enviar foto para o Google Drive:', err);
            uploadError = true;
          }
        }

        // Upload scans 3D to backend Google Drive integration
        for (const f of scanFiles) {
          try {
            await api.attachments.uploadFile(f, caseId, patientName, dentistName, 'escaneamento', fallbackDentistId);
          notificationService.add(
            'Novo Arquivo Enviado',
            `O dentista "${dentistName}" enviou o escaneamento "${f.name}" para o caso ${caseId}.`,
            'file_uploaded',
            caseId
          );
        } catch (err: any) {
          console.error('Erro ao enviar escaneamento para o Google Drive:', err);
          uploadError = true;
        }
      }

      let hasUploadError = false;

      if (uploadError) {
        hasUploadError = true;
      }
      
      // Trigger notifications for new/modified cases
      if (editingCase) {
        notificationService.add(
          'Solicitação de Caso Editada',
          `O dentista "${dentistName}" atualizou a solicitação do caso ${caseId} (${patientName}).`,
          'case_modified',
          caseId
        );
      } else {
        notificationService.add(
          'Novo Caso Solicitado',
          `O dentista "${dentistName}" solicitou um novo caso para o paciente "${patientName}".`,
          'new_case',
          caseId
        );
      }
      
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
      setCurrentTab('dentist-cases');
      
      fetchData();
      if (hasUploadError) {
        setShowErrorPopup(true);
      } else {
        setShowSuccessPopup(true);
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar o caso. Detalhes: ' + (err.message || 'Erro de comunicação'));
      setShowErrorPopup(true);
      setSubmitting(false);
    }
  };

  const startEdit = (caseItem: Case) => {
    setActiveTab('new-case');
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
    setCurrentTab('dentist-new-case');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    if (!newPassword) {
      setPassError('Por favor, insira uma nova senha.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.updatePassword(newPassword);
      setPassSuccess('Senha atualizada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError('Erro ao atualizar a senha.');
    } finally {
      setSubmitting(false);
    }
  };

  // Financial totals
  const totalOwed = cases
    .filter(c => c.financial_released && c.financial_status !== 'pago' && c.financial_status !== 'isento' && c.status !== 'cancelado')
    .reduce((sum, c) => sum + c.remaining_value, 0);

  const getStatusBadge = (status: CaseStatus) => {
    const styles: Record<CaseStatus, string> = {
      recebido: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      em_analise: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      aguardando_aprovacao: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      aguardando_arquivos: 'bg-rose-600 text-white border-rose-700 animate-pulse font-black shadow-xs shadow-rose-200',
      em_execucao: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      finalizado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      entregue: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
      cancelado: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };
    return (
      <span className={`px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide rounded-full border ${styles[status]}`}>
        {status === 'em_analise' ? 'Aguardando Análise' : status === 'aguardando_arquivos' ? 'Pendente Envio de Arquivo' : status.replace('_', ' ')}
      </span>
    );
  };

  const dentistServices = services.filter(s => !s.is_internal_cost);

  const getServiceNames = (caseItem: Case) => {
    if (!caseItem.selected_services || caseItem.selected_services.length === 0) {
      const matched = services.find(s => s.default_value === caseItem.total_value);
      return matched ? matched.name : 'Outro';
    }
    return caseItem.selected_services
      .map(id => services.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const filteredActiveCases = cases.filter(c => {
    const isMatchedStatus = !['finalizado', 'entregue', 'cancelado'].includes(c.status);
    const matchesSearch = searchQuery.trim() === '' || 
      c.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getServiceNames(c).toLowerCase().includes(searchQuery.toLowerCase());
    return isMatchedStatus && matchesSearch;
  });

  const filteredFinalizedCases = cases.filter(c => {
    const isMatchedStatus = ['finalizado', 'entregue'].includes(c.status);
    const matchesSearch = searchQuery.trim() === '' || 
      c.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getServiceNames(c).toLowerCase().includes(searchQuery.toLowerCase());
    return isMatchedStatus && matchesSearch;
  });

  const itemsPerFinalizedPage = 10;
  const totalFinalizedPages = Math.max(1, Math.ceil(filteredFinalizedCases.length / itemsPerFinalizedPage));
  const paginatedFinalizedCases = filteredFinalizedCases.slice(
    (finalizedPage - 1) * itemsPerFinalizedPage,
    finalizedPage * itemsPerFinalizedPage
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Portal do Dentista</h2>
          <p className="text-slate-500 text-xs mt-1">
            Envie novos pedidos de prótese, envie escaneamentos/arquivos e controle seu extrato financeiro.
          </p>
        </div>

        {/* Total Owed card */}
        {!isAuxiliar && (
          <div className="bg-white border border-[#E2E8F0] px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-3 w-fit">
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0F766E]">
              <DollarSign size={16} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Saldo Devedor Geral</span>
              <span className="text-base font-bold text-slate-900">R$ {totalOwed.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-[#E2E8F0] w-full gap-6 mb-2 pb-px">
        <button
          onClick={() => {
            setCurrentTab('dentist-cases');
            setEditingCase(null);
          }}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'my-cases'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Meus Casos
        </button>
        <button
          onClick={() => setCurrentTab('dentist-new-case')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'new-case'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          {editingCase ? 'Editar Solicitação' : 'Solicitar Novo Trabalho'}
        </button>
        <button
          onClick={() => setActiveTab('change-password')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'change-password'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Alterar Senha
        </button>
      </div>

      {activeTab === 'my-cases' && (
        /* MY CASES TAB */
        <div className="space-y-6 animate-fade-in">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm font-medium">Carregando seus casos...</div>
          ) : (
            <div className="space-y-6">
              
              {/* Search Bar */}
              <div className="relative max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar casos por paciente, ID ou procedimento..."
                  className="w-full pl-10 pr-4 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
                />
              </div>

              {/* Active Cases Table */}
              <div className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3.5">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Clock size={16} className="text-[#0F766E]" />
                      Pedidos em Andamento
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Trabalhos solicitados e atualmente em produção ou análise.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-[#ECFDF5] text-[#0F766E] border border-emerald-100 px-2 py-0.5 rounded-md">
                    {filteredActiveCases.length} Ativo{filteredActiveCases.length > 1 ? 's' : ''}
                  </span>
                </div>

                {filteredActiveCases.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 bg-slate-50 rounded-lg">
                    Nenhum pedido ativo no momento.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="p-3">ID do Caso</th>
                          <th className="p-3">Paciente</th>
                          <th className="p-3">Procedimento(s)</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Previsão</th>
                          <th className="p-3">Custo Total</th>
                          <th className="p-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {filteredActiveCases.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-all">
                            <td className="p-3 font-semibold text-slate-800 font-mono text-[11px]">{c.id}</td>
                            <td className="p-3 font-bold text-slate-900">{c.patient_name}</td>
                            <td className="p-3 text-slate-600 font-medium">{getServiceNames(c)}</td>
                            <td className="p-3">{getStatusBadge(c.status)}</td>
                            <td className="p-3 text-slate-500 font-medium font-mono">
                              {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                            </td>
                            <td className="p-3 font-semibold text-slate-700">
                              {isAuxiliar ? (
                                <span className="text-slate-400 italic text-[10px]">Restrito</span>
                              ) : (c.financial_released || c.financial_status === 'pago' || c.financial_status === 'isento') ? `R$ ${c.total_value.toFixed(2)}` : <span className="text-slate-400 italic text-[10px]">Aguardando liberação</span>}
                            </td>
                            <td className="p-3 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                {caseResults[c.id] && (
                                  <button
                                    onClick={() => setViewingResultsFiles(caseResults[c.id])}
                                    className="inline-flex items-center gap-1 bg-[#0F766E] hover:bg-[#115E59] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-all cursor-pointer shadow-xs animate-fade-in"
                                  >
                                    Acessar Resultado
                                  </button>
                                )}
                                <button
                                  onClick={() => startEdit(c)}
                                  className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all cursor-pointer"
                                >
                                  Editar
                                </button>

                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Finalized Cases Table */}
              <div className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3.5">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-500" />
                      Trabalhos Concluídos
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Casos entregues ou prontos para retirada/envio.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-[#ECFDF5] text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md">
                    {filteredFinalizedCases.length} Concluído{filteredFinalizedCases.length > 1 ? 's' : ''}
                  </span>
                </div>

                {filteredFinalizedCases.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 bg-slate-50 rounded-lg">
                    Nenhum trabalho concluído ainda.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="p-3">ID do Caso</th>
                            <th className="p-3">Paciente</th>
                            <th className="p-3">Procedimento(s)</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Valores</th>
                            <th className="p-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {paginatedFinalizedCases.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/70 transition-all">
                              <td className="p-3 font-semibold text-slate-800 font-mono text-[11px]">{c.id}</td>
                              <td className="p-3 font-bold text-slate-900">{c.patient_name}</td>
                              <td className="p-3 text-slate-600 font-medium">{getServiceNames(c)}</td>
                              <td className="p-3">
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-extrabold uppercase tracking-wide">
                                  {c.status === 'entregue' ? 'Entregue' : 'Finalizado'}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-4">
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Valor Total</p>
                                    <p className="text-xs font-bold text-slate-900">
                                      {isAuxiliar ? (
                                        <span className="text-slate-400 italic font-normal text-[10px]">Restrito</span>
                                      ) : (c.financial_released || c.financial_status === 'pago' || c.financial_status === 'isento') ? `R$ ${c.total_value.toFixed(2)}` : <span className="text-slate-400 italic font-normal text-[10px]">Aguardando liberação</span>}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Valor Pago</p>
                                    <p className="text-xs font-bold text-emerald-600">
                                      {isAuxiliar ? (
                                        <span className="text-slate-400 italic font-normal text-[10px]">Restrito</span>
                                      ) : (c.financial_released || c.financial_status === 'pago' || c.financial_status === 'isento') ? `R$ ${c.paid_value.toFixed(2)}` : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Saldo Devedor</p>
                                    <p className="text-xs font-bold text-rose-600">
                                      {isAuxiliar ? (
                                        <span className="text-slate-400 italic font-normal text-[10px]">Restrito</span>
                                      ) : (c.financial_released || c.financial_status === 'pago' || c.financial_status === 'isento') ? `R$ ${c.remaining_value.toFixed(2)}` : '—'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  {caseResults[c.id] && (
                                    <button
                                      onClick={() => setViewingResultsFiles(caseResults[c.id])}
                                      className="inline-flex items-center gap-1 bg-[#0F766E] hover:bg-[#115E59] text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-all cursor-pointer shadow-xs animate-fade-in"
                                    >
                                      Acessar Resultado
                                    </button>
                                  )}

                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalFinalizedPages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#E2E8F0] gap-4 text-xs font-medium text-slate-500">
                        <div>
                          Exibindo {Math.min(filteredFinalizedCases.length, (finalizedPage - 1) * itemsPerFinalizedPage + 1)} a {Math.min(filteredFinalizedCases.length, finalizedPage * itemsPerFinalizedPage)} de {filteredFinalizedCases.length} casos concluídos
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={finalizedPage === 1}
                            onClick={() => setFinalizedPage(prev => Math.max(1, prev - 1))}
                            className="p-2 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                            title="Anterior"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="font-semibold text-slate-700">Página {finalizedPage} de {totalFinalizedPages}</span>
                          <button
                            type="button"
                            disabled={finalizedPage === totalFinalizedPages}
                            onClick={() => setFinalizedPage(prev => Math.min(totalFinalizedPages, prev + 1))}
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

            </div>
          )}
        </div>
      )}

      {activeTab === 'new-case' && (
        editingCase && editingCase.dentist_id !== user?.id ? (
          <div className="glass-panel p-8 max-w-xl mx-auto text-center space-y-4 animate-fade-in my-8">
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-500">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Acesso Bloqueado</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Você não tem permissão para acessar esta pasta.
            </p>
            <button
              onClick={() => {
                setEditingCase(null);
                setCurrentTab('dentist-cases');
              }}
              className="px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer font-bold"
            >
              Voltar para Meus Casos
            </button>
          </div>
        ) : (
          /* SOLICITAR NOVO TRABALHO TAB */
          <div className="glass-panel p-6 animate-fade-in space-y-6">
          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-[#0F766E]" />
              {editingCase ? `Editando Solicitação: ${editingCase.patient_name}` : 'Solicitar Novo Trabalho'}
            </h3>
            {editingCase && (
              <button
                type="button"
                onClick={() => {
                  setEditingCase(null);
                  setCurrentTab('dentist-cases');
                  setPatientName('');
                  setDentistNotes('');
                  setTeethSelection({ teeth: [], type: 'individual' });
                  setHasPhoto(false);
                  setHasFile(false);
                  setSelectedServices({});
                  setPhotoFiles([]);
                  setScanFiles([]);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
              >
                Cancelar Edição
              </button>
            )}
          </div>

          {/* Alert / Informational disclaimer */}
          <div className="p-3.5 rounded-lg bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] flex gap-3 text-xs leading-relaxed font-medium">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>
              <strong>Atenção:</strong> A data solicitada abaixo é apenas uma indicação da sua necessidade de agenda. 
              A data oficial de entrega será analisada e confirmada pelo Dr. Matheus de acordo com a fila de produção.
            </p>
          </div>

          <form onSubmit={handleCreateCase} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                  Nome do Paciente
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nome do paciente"
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                  Data de Entrega Solicitada
                </label>
                <input
                  type="date"
                  required
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
                />
              </div>
            </div>

            {/* Checklist of allowed services (multi-selection, hidden prices) */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                Procedimento(s) Requerido(s) (Selecione um ou mais)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50/50 p-4 rounded-lg border border-[#E2E8F0]">
                {dentistServices.map(s => {
                  const isChecked = !!selectedServices[s.id];
                  return (
                    <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-all">
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
                        className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                      />
                      <label htmlFor={`dentist-serv-${s.id}`} className="text-xs font-medium text-slate-700 cursor-pointer flex-1">
                        {s.name}
                      </label>
                    </div>
                  );
                })}
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
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Observações Clínicas / Recomendações
              </label>
              <textarea
                rows={3}
                value={dentistNotes}
                onChange={(e) => setDentistNotes(e.target.value)}
                placeholder="Insira detalhes adicionais sobre cor, material, espessura ou particularidades..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
              />
            </div>



            {/* File Upload zones (Separate Fotos / Escaneamentos) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fotos Clínicas zone */}
              <div className="p-5 rounded-lg border border-dashed border-[#E2E8F0] bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 text-[#0F766E] font-bold text-[10px] uppercase tracking-wider">
                  <Paperclip size={14} />
                  Enviar Fotos Clínicas
                </div>
                <p className="text-[10px] text-slate-400">Arraste ou clique para enviar fotos clínicas (JPG, PNG).</p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setPhotoFiles(prev => [...prev, ...files]);
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
                
                {/* Exibir arquivos de imagem já enviados */}
                {editingCase && dentistFiles[editingCase.id] && dentistFiles[editingCase.id].filter(f => f.file_category === 'imagens').length > 0 && (
                  <div className="pt-3 mt-3 border-t border-[#E2E8F0] space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fotos já enviadas</p>
                    {dentistFiles[editingCase.id].filter(f => f.file_category === 'imagens').map((att) => (
                      <div key={att.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg text-[10px] border border-[#E2E8F0]">
                        <span className="truncate max-w-[120px] text-slate-800 font-semibold" title={att.file_name}>{att.file_name}</span>
                        {att.web_view_link && (
                          <a
                            href={att.web_view_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0F766E] hover:underline font-bold px-1.5"
                          >
                            Visualizar
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Escaneamentos 3D zone */}
              <div className="p-5 rounded-lg border border-dashed border-[#E2E8F0] bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 text-[#0F766E] font-bold text-[10px] uppercase tracking-wider">
                  <Paperclip size={14} />
                  Enviar Escaneamento (3D)
                </div>
                <p className="text-[10px] text-slate-400">Arraste ou clique para enviar escaneamentos 3D (STL, OBJ, PLY, ZIP).</p>
                <input
                  type="file"
                  multiple
                  accept=".stl,.obj,.ply,.zip,.rar"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setScanFiles(prev => [...prev, ...files]);
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
                
                {/* Exibir arquivos de escaneamento já enviados */}
                {editingCase && dentistFiles[editingCase.id] && dentistFiles[editingCase.id].filter(f => f.file_category === 'escaneamento').length > 0 && (
                  <div className="pt-3 mt-3 border-t border-[#E2E8F0] space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Escaneamentos já enviados</p>
                    {dentistFiles[editingCase.id].filter(f => f.file_category === 'escaneamento').map((att) => (
                      <div key={att.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg text-[10px] border border-[#E2E8F0]">
                        <span className="truncate max-w-[120px] text-slate-800 font-semibold" title={att.file_name}>{att.file_name}</span>
                        {att.web_view_link && (
                          <a
                            href={att.web_view_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0F766E] hover:underline font-bold px-1.5"
                          >
                            Baixar/Ver
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => {
                  setEditingCase(null);
                  setCurrentTab('dentist-cases');
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-transparent transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 bg-[#0F766E] hover:bg-[#0F766E]/90 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send size={14} />
                {editingCase ? 'Salvar Alterações' : 'Enviar Solicitação'}
              </button>
            </div>

          </form>

        </div>
        )
      )}

      {activeTab === 'change-password' && (
        /* ALTERAR SENHA TAB */
        <div className="glass-panel p-5 max-w-md animate-fade-in space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Alterar Senha</h3>
            <p className="text-xs text-slate-500 mt-1">
              Atualize sua senha de acesso ao portal.
            </p>
          </div>

          {passError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium">
              {passError}
            </div>
          )}

          {passSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-medium">
              {passSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Nova Senha
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Insira a nova senha"
                className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
                className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#0F766E] hover:bg-[#0F766E]/90 text-white font-semibold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {submitting ? 'Atualizando...' : 'Atualizar Senha'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Uploading progress modal */}
      {submitting && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center shadow-2xl relative text-slate-900 flex flex-col items-center">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#0F766E] rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-[#0F766E]">
                <Send size={20} className="animate-pulse" />
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Enviando Arquivos...</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[250px]">
              Aguarde enquanto sincronizamos as informações e os arquivos com o Google Drive. Isso pode levar alguns minutos dependendo do tamanho.
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* Case submitted successfully popup modal */}
      {showSuccessPopup && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center shadow-[0_4px_24px_rgba(15,23,42,0.08)] relative text-slate-900">
            <div className="w-12 h-12 rounded-full bg-[#ECFDF5] border border-emerald-100 flex items-center justify-center mx-auto mb-4 text-[#0F766E]">
              <CheckCircle size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Caso Enviado com Sucesso!</h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Sua solicitação de caso foi registrada e os arquivos foram processados com sucesso.
            </p>
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="w-full py-2 bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold rounded-lg text-xs transition-all cursor-pointer"
            >
              OK, fechar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Case submitted with error popup modal */}
      {showErrorPopup && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center shadow-[0_4px_24px_rgba(15,23,42,0.08)] relative text-slate-900">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-500">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Atenção ao Enviar Arquivos</h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Caso salvo com sucesso, porém ocorreu um problema ao enviar os arquivos anexos. Por favor, tente enviá-los novamente ou entre em contato com o laboratório.
            </p>
            <button
              onClick={() => setShowErrorPopup(false)}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Result Files Modal */}
      {viewingResultsFiles && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-[0_4px_24px_rgba(15,23,42,0.08)] relative text-slate-900">
            <button
              onClick={() => setViewingResultsFiles(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <FolderOpen size={16} className="text-[#0F766E]" />
              Arquivos de Resultado Disponíveis
            </h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Dr. Matheus disponibilizou os seguintes arquivos de resultado para este caso:
            </p>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {viewingResultsFiles.map(att => (
                <div key={att.id} className="flex items-center justify-between p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl shadow-2xs hover:bg-slate-100/50 transition-all text-left">
                  <div className="min-w-0 flex-1 pr-3">
                    <h5 className="text-xs font-semibold text-slate-800 truncate" title={att.file_name}>
                      {att.file_name}
                    </h5>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400 font-medium">
                      <span>{att.file_category === 'enceramento_digital' ? 'Enceramento Digital' : 'Resultado Final'}</span>
                      {att.file_size && (
                        <span>· {(att.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      )}
                    </div>
                  </div>
                  {att.web_view_link && (
                    <a
                      href={att.web_view_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-3 bg-white hover:bg-slate-50 text-[#0F766E] border border-[#E2E8F0] text-center rounded-lg text-[10px] font-bold transition-all whitespace-nowrap shadow-3xs cursor-pointer"
                    >
                      Visualizar/Baixar
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setViewingResultsFiles(null)}
                className="px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold rounded-lg text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
