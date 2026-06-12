import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, Service, OdontogramSelection, CaseStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { Odontogram } from './Odontogram';
import { 
  AlertCircle, DollarSign, 
  Clock, CheckCircle, FolderOpen, Send, Paperclip 
} from 'lucide-react';

interface DentistDashboardProps {
  initialTab?: 'my-cases' | 'new-case';
}

export const DentistDashboard: React.FC<DentistDashboardProps> = ({ initialTab = 'my-cases' }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [activeTab, setActiveTab] = useState<'my-cases' | 'new-case' | 'change-password'>(initialTab);
  const [loading, setLoading] = useState(true);
  
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

      const caseId = editingCase?.id || `CASE-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(cases.length + 1).padStart(4, '0')}`;
      const driveFolderUrl = `https://drive.google.com/drive/folders/1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN?usp=sharing`;

      const payload: Case = {
        id: caseId,
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
        value_planning: 0,
        value_paschoal: valPaschoal,
        cost_allan_matheus: 0,
        cost_allan_solo: 0,
        cost_andrey: editingCase?.cost_andrey || 0,
        other_internal_costs: editingCase?.other_internal_costs || [],
        total_value: computedTotalValue,
        paid_value: editingCase?.paid_value || 0,
        remaining_value: computedTotalValue - (editingCase?.paid_value || 0),
        google_drive_folder_id: editingCase?.google_drive_folder_id || `folder-mock-${Date.now()}`,
        google_drive_folder_url: editingCase?.google_drive_folder_url || driveFolderUrl,
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
        <div className="bg-white border border-[#E2E8F0] px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-3 w-fit">
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0F766E]">
            <DollarSign size={16} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Saldo Devedor Geral</span>
            <span className="text-base font-bold text-slate-900">R$ {totalOwed.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] w-full gap-6 mb-2 pb-px">
        <button
          onClick={() => {
            setActiveTab('my-cases');
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
          onClick={() => setActiveTab('new-case')}
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
                    {activeCases.length} Ativo{activeCases.length > 1 ? 's' : ''}
                  </span>
                </div>

                {activeCases.length === 0 ? (
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
                        {activeCases.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-all">
                            <td className="p-3 font-semibold text-slate-800 font-mono text-[11px]">{c.id}</td>
                            <td className="p-3 font-bold text-slate-900">{c.patient_name}</td>
                            <td className="p-3 text-slate-600 font-medium">{getServiceNames(c)}</td>
                            <td className="p-3">{getStatusBadge(c.status)}</td>
                            <td className="p-3 text-slate-500 font-medium font-mono">
                              {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                            </td>
                            <td className="p-3 font-bold text-slate-900">R$ {c.total_value.toFixed(2)}</td>
                            <td className="p-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => startEdit(c)}
                                  className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all cursor-pointer"
                                >
                                  Editar
                                </button>
                                {c.google_drive_folder_url && (
                                  <a
                                    href={c.google_drive_folder_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center p-1.5 rounded-md bg-[#ECFDF5] text-[#0F766E] border border-emerald-100 hover:bg-[#ECFDF5]/80 transition-all cursor-pointer"
                                    title="Google Drive"
                                  >
                                    <FolderOpen size={13} />
                                  </a>
                                )}
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
                    {finalizedCases.length} Concluído{finalizedCases.length > 1 ? 's' : ''}
                  </span>
                </div>

                {finalizedCases.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 bg-slate-50 rounded-lg">
                    Nenhum trabalho concluído ainda.
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
                          <th className="p-3">Valor Total</th>
                          <th className="p-3">Pago</th>
                          <th className="p-3">Aberto</th>
                          <th className="p-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {finalizedCases.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-all">
                            <td className="p-3 font-semibold text-slate-800 font-mono text-[11px]">{c.id}</td>
                            <td className="p-3 font-bold text-slate-900">{c.patient_name}</td>
                            <td className="p-3 text-slate-600 font-medium">{getServiceNames(c)}</td>
                            <td className="p-3">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-extrabold uppercase tracking-wide">
                                {c.status === 'entregue' ? 'Entregue' : 'Finalizado'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-900">R$ {c.total_value.toFixed(2)}</td>
                            <td className="p-3 font-semibold text-emerald-600">R$ {c.paid_value.toFixed(2)}</td>
                            <td className="p-3 font-semibold text-slate-700">R$ {c.remaining_value.toFixed(2)}</td>
                            <td className="p-3 text-right">
                              {c.google_drive_folder_url && (
                                <a
                                  href={c.google_drive_folder_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center p-1.5 rounded-md bg-[#ECFDF5] text-[#0F766E] border border-emerald-100 hover:bg-[#ECFDF5]/80 transition-all cursor-pointer"
                                  title="Google Drive"
                                >
                                  <FolderOpen size={13} />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {activeTab === 'new-case' && (
        /* SOLICITAR NOVO TRABALHO TAB */
        <div className="glass-panel p-5 max-w-5xl animate-fade-in space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {editingCase ? 'Editar Solicitação' : 'Nova Solicitação de Serviço'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre o nome do paciente, selecione os dentes e insira observações para o Dr. Matheus.
            </p>
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

            {/* Warning note for file uploads */}
            <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#166534] font-medium flex items-center gap-2">
              <FolderOpen size={16} className="text-[#0F766E] shrink-0" />
              <span>
                Os arquivos enviados serão salvos na pasta correspondente no Google Drive: <strong>Fotos</strong> para imagens e <strong>Escaneamento</strong> para arquivos 3D.
              </span>
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
                          className="text-rose-600 hover:text-rose-700 font-semibold px-1.5"
                        >
                          Remover
                        </button>
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
                          className="text-rose-600 hover:text-rose-700 font-semibold px-1.5"
                        >
                          Remover
                        </button>
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
                  setActiveTab('my-cases');
                }}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-transparent transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 bg-[#0F766E] hover:bg-[#0F766E]/90 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all disabled:opacity-50"
              >
                <Send size={14} />
                {submitting ? 'Enviando...' : editingCase ? 'Salvar Alterações' : 'Enviar Solicitação'}
              </button>
            </div>

          </form>

        </div>
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
    </div>
  );
};
