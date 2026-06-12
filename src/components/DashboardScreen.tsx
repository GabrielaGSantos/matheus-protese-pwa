import React, { useState, useEffect, useRef } from 'react';
import { api, recordActivity } from '../services/api';
import type { Case, Profile } from '../types';
import { 
  DollarSign, Briefcase, Clock, AlertTriangle, 
  CheckCircle, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

interface DashboardScreenProps {
  onSelectCase?: (caseId: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onSelectCase }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const fileData = evt.target?.result;
        if (!fileData) return;

        const workbook = XLSX.read(fileData, { type: 'array' });
        const targetSheets = [
          'Maio26', 'Abril26', 'Março26', 'Fevereiro26', 'Janeiro26',
          'Dezembro25', 'Novembro25', 'Outubro25', 'Setembro25', 'Agosto25',
          'Junho e Julho25', 'Abril25', 'Março25'
        ];

        const getJsDate = (excelSerial: any) => {
          if (!excelSerial) return new Date().toISOString();
          if (typeof excelSerial === 'string') {
            const d = new Date(excelSerial);
            return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          }
          // Convert serial to JS date
          const date = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
          return date.toISOString();
        };

        const profiles: Profile[] = JSON.parse(localStorage.getItem('matheus_protese_profiles') || '[]');
        const dentistNameMap: Record<string, string> = {};

        // Seed name mapping from existing profiles
        profiles.forEach(p => {
          if (p.role === 'dentist') {
            const norm = p.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            dentistNameMap[norm] = p.id;
          }
        });

        const allCases: Case[] = [];
        let caseCount = 1;

        workbook.SheetNames.forEach(sheetName => {
          if (!targetSheets.includes(sheetName)) return;
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

          rows.forEach((row, idx) => {
            const clientName = String(row['Cliente'] || '').trim();
            if (!clientName) return;

            const normClient = clientName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            let dentistId = dentistNameMap[normClient];

            if (!dentistId) {
              // Create dynamic dentist
              dentistId = `dentist-dynamic-${normClient || 'unknown'}`;
              const newProfile: Profile = {
                id: dentistId,
                role: 'dentist',
                full_name: clientName,
                whatsapp: '',
                created_at: new Date().toISOString()
              };
              profiles.push(newProfile);
              dentistNameMap[normClient] = dentistId;
            }

            const rawDate = row['Data Recebido'] || row['Data'] || row['data'] || row['Data recebido'];
            const isoDateStr = getJsDate(rawDate);
            const datePart = isoDateStr.split('T')[0];
            const yearMonth = datePart.slice(0, 7).replace('-', '');

            const caseId = `CASE-${yearMonth}-${String(caseCount++).padStart(4, '0')}`;

            const valueMatheus = parseFloat(row['Valor Matheus']) || 0;
            const valuePlanning = parseFloat(row['Valor Planning']) || 0;
            const valuePaschoal = parseFloat(row['Valor Paschoal']) || 0;
            const costAllanMatheus = parseFloat(row['Allan/Matheus']) || 0;
            const costAllanSolo = parseFloat(row['Allan Solo']) || 0;
            const costAndrey = parseFloat(row['Andrey']) || 0;

            const calculatedTotal = valueMatheus + valuePlanning + valuePaschoal;
            const statusText = String(row['Status'] || 'Aguardando Pagamento').toLowerCase();

            const caseYear = new Date(isoDateStr).getFullYear();
            let financialStatus: 'pago' | 'isento' | 'aguardando_pagamento' = 'aguardando_pagamento';
            if (caseYear < 2026) {
              financialStatus = 'pago';
            } else if (statusText.includes('pago')) {
              financialStatus = 'pago';
            } else if (statusText.includes('isento')) {
              financialStatus = 'isento';
            }

            allCases.push({
              id: caseId,
              dentist_id: dentistId,
              patient_name: String(row['Paciente'] || 'Sem Nome'),
              created_at: isoDateStr,
              requested_delivery_date: datePart,
              final_delivery_date: datePart,
              status: 'finalizado',
              financial_status: financialStatus,
              teeth_selection: { teeth: [], type: 'individual' },
              dentist_notes: String(row['Observações'] || ''),
              internal_notes: `Feito por: ${row['Feito por'] || 'N/A'}`,
              has_photo: false,
              has_file: false,
              estimated_hours: 0,
              value_matheus: valueMatheus,
              value_planning: valuePlanning,
              value_paschoal: valuePaschoal,
              cost_allan_matheus: costAllanMatheus,
              cost_allan_solo: costAllanSolo,
              cost_andrey: costAndrey,
              other_internal_costs: [],
              total_value: calculatedTotal,
              paid_value: financialStatus === 'pago' ? calculatedTotal : 0,
              remaining_value: financialStatus === 'pago' ? 0 : calculatedTotal,
              google_drive_folder_id: `folder-imported-${idx}`,
              google_drive_folder_url: 'https://drive.google.com/drive/folders/1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN?usp=sharing',
              updated_at: isoDateStr
            });
          });
        });

        // Save to LocalStorage
        localStorage.setItem('matheus_protese_profiles', JSON.stringify(profiles));
        localStorage.setItem('matheus_protese_cases', JSON.stringify(allCases));

        await recordActivity('importacao', '', { count: allCases.length });

        alert(`Planilha importada com sucesso! ${allCases.length} casos e novos dentistas foram carregados.`);
        fetchData();
      } catch (err) {
        console.error(evt);
        console.error(err);
        alert('Erro ao processar a planilha. Verifique o formato do arquivo.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const c = await api.cases.list('admin', 'admin-1');
      const p = await api.profiles.list();
      setCases(c);
      setDentists(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500 text-sm font-medium">Carregando painel de controle...</div>;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Currency format helper
  const formatCurrency = (val: number) => {
    return 'R$ ' + val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // KPI Calculations (ignoring cases before 2026 for faturamento and balances)
  const monthlyGrossBilled = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado';
    })
    .reduce((sum, c) => sum + c.total_value, 0);

  const monthlyReceived = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado';
    })
    .reduce((sum, c) => sum + (c.paid_value || 0), 0);

  const monthlyPending = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado';
    })
    .reduce((sum, c) => sum + (c.remaining_value || 0), 0);

  const otherMonthsPending = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && !c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado';
    })
    .reduce((sum, c) => sum + (c.remaining_value || 0), 0);

  const activeCasesCount = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && !['finalizado', 'entregue', 'cancelado'].includes(c.status);
  }).length;

  const finishedCasesCount = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && c.status === 'finalizado';
  }).length;

  const awaitingPaymentCount = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && c.financial_status === 'aguardando_pagamento';
  }).length;

  const isUnapproved = (c: Case) => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && 
      (c.status === 'em_analise' || c.status === 'recebido') && 
      c.dentist_id !== 'admin-1' && 
      c.dentist_id !== 'sec-1';
  };

  const unapprovedCases = cases.filter(isUnapproved);
  const awaitingAnalysisCount = unapprovedCases.length;

  // Delayed cases (only 2026 onwards)
  const delayedCases = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 &&
      c.final_delivery_date && 
      c.final_delivery_date < todayStr && 
      !['finalizado', 'entregue', 'cancelado'].includes(c.status) &&
      !isUnapproved(c);
  });

  // Production queue: active cases (only 2026 onwards) sorted by final delivery date
  const productionQueue = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && !['finalizado', 'entregue', 'cancelado'].includes(c.status) && !isUnapproved(c);
    })
    .sort((a, b) => {
      if (!a.final_delivery_date) return 1;
      if (!b.final_delivery_date) return -1;
      return a.final_delivery_date.localeCompare(b.final_delivery_date);
    });

  // Capacity calculations: sum estimated hours of active cases (only 2026 onwards)
  const totalEstimatedHours = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && !['finalizado', 'entregue', 'cancelado'].includes(c.status) && !isUnapproved(c);
    })
    .reduce((sum, c) => sum + c.estimated_hours, 0);

  const isOverloaded = totalEstimatedHours > 44;

  const handleApproveCase = async (e: React.MouseEvent, c: Case) => {
    e.stopPropagation();
    try {
      const updated = {
        ...c,
        status: 'em_execucao' as const,
        updated_at: new Date().toISOString()
      };
      await api.cases.save(updated, 'admin-1');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityColor = (caseItem: Case) => {
    if (!caseItem.final_delivery_date) return 'text-slate-400 bg-slate-50 border-slate-100';
    const diffTime = new Date(caseItem.final_delivery_date).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-rose-600 bg-[#FEE2E2] border-rose-100';
    if (diffDays <= 2) return 'text-amber-600 bg-[#FEF3C7] border-amber-100';
    return 'text-[#0F766E] bg-[#ECFDF5] border-emerald-100';
  };

  const getPriorityText = (caseItem: Case) => {
    if (!caseItem.final_delivery_date) return 'Sem Prazo';
    const diffTime = new Date(caseItem.final_delivery_date).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Atrasado';
    if (diffDays <= 2) return 'Urgente';
    return 'No Prazo';
  };

  const formatEstimatedTime = (time: number) => {
    const h = Math.floor(time);
    const m = Math.round((time - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Info */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Painel Geral</h2>
          <p className="text-slate-500 text-xs mt-1">
            Resumo financeiro e fluxo de produção para o mês atual.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {isAdmin && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                Importar Planilha Excel (.xlsx)
              </button>
            </>
          )}

          {/* Overload status banner */}
          <div className={`px-4 py-2.5 rounded-lg border flex items-center gap-2.5 w-fit ${
            isOverloaded 
              ? 'bg-[#FEE2E2] text-rose-600 border-rose-100' 
              : 'bg-[#ECFDF5] text-[#0F766E] border-emerald-100'
          }`}>
            <span>
              {isOverloaded ? <ShieldAlert size={16} /> : <CheckCircle size={16} />}
            </span>
            <div className="text-xs font-semibold">
              <h5 className="uppercase tracking-wider text-[10px]">{isOverloaded ? 'Alerta de Sobrecarga' : 'Capacidade Normal'}</h5>
              <p className="opacity-90 font-medium text-[11px] mt-0.5">{totalEstimatedHours.toFixed(1)}h de produção ativa (Máx: 44h/semana)</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI: Rendimento Bruto Mensal */}
        <div className="glass-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Rendimento Mensal</span>
            <h3 className="text-xl font-bold text-slate-900">{formatCurrency(monthlyGrossBilled)}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Faturamento bruto de {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[#0F766E]">
            <DollarSign size={16} />
          </div>
        </div>

        {/* KPI: Recebido no Mês */}
        <div className="glass-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recebido no Mês</span>
            <h3 className="text-xl font-bold text-emerald-600">{formatCurrency(monthlyReceived)}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Total pago este mês
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle size={16} />
          </div>
        </div>

        {/* KPI: Falta Receber */}
        <div className="glass-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Falta Receber (Mês)</span>
            <h3 className="text-xl font-bold text-amber-600">{formatCurrency(monthlyPending)}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Saldo pendente deste mês
            </p>
            {otherMonthsPending > 0 && (
              <p className="text-[9px] text-rose-500 font-bold mt-1.5 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded w-fit">
                ⚠️ Outros meses pendentes: {formatCurrency(otherMonthsPending)}
              </p>
            )}
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock size={16} />
          </div>
        </div>

        {/* KPI: Casos em Execução */}
        <div className="glass-panel p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Casos em Execução</span>
            <h3 className="text-xl font-bold text-slate-900">{activeCasesCount}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Fila operacional ativa</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600">
            <Briefcase size={16} />
          </div>
        </div>

      </div>

      {/* Novas Solicitações (Aguardando Aprovação) */}
      {unapprovedCases.length > 0 && (
        <div className="glass-panel p-5 border border-amber-200 space-y-4">
          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3.5">
            <div>
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Novas Solicitações de Clientes (Aguardando Aprovação)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Novos casos enviados por dentistas parceiros que precisam ser aceitos para entrar na fila.
              </p>
            </div>
            <span className="text-[10px] font-bold bg-[#FEF3C7] text-amber-600 border border-amber-100 px-2 py-0.5 rounded-md">
              {unapprovedCases.length} Pendente{unapprovedCases.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3">ID do Caso</th>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Dentista Requisitante</th>
                  <th className="p-3">Prazo Solicitado</th>
                  <th className="p-3">Observações Clínicas</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {unapprovedCases.map(c => {
                  const dentist = dentists.find(d => d.id === c.dentist_id);
                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => onSelectCase && onSelectCase(c.id)}
                      className="hover:bg-slate-50/70 transition-all cursor-pointer"
                    >
                      <td className="p-3 font-semibold text-slate-800 font-mono text-[11px]">{c.id}</td>
                      <td className="p-3 font-bold text-slate-900">{c.patient_name}</td>
                      <td className="p-3 text-slate-600 font-medium">{dentist?.full_name || 'Desconhecido'}</td>
                      <td className="p-3 text-slate-500">
                        {c.requested_delivery_date ? new Date(c.requested_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                      </td>
                      <td className="p-3 text-slate-500 truncate max-w-[200px] italic">
                        {c.dentist_notes ? `"${c.dentist_notes}"` : 'Sem observações'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => handleApproveCase(e, c)}
                          className="inline-flex items-center gap-1 bg-[#0F766E] hover:bg-[#0F766E]/90 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-all cursor-pointer"
                        >
                          <CheckCircle size={12} />
                          Aprovar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid: Alertas e Fila de Produção */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Alertas Odontológicos */}
        <div className="glass-panel p-5 space-y-4">
          <h4 className="font-bold text-sm text-slate-900 border-b border-[#E2E8F0] pb-2.5">Alertas Laboratoriais</h4>
          
          <div className="space-y-2.5">
            {/* Casos em atraso */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#FEE2E2] text-rose-600 border border-rose-100">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} />
                <span className="text-xs font-semibold">Casos em atraso</span>
              </div>
              <span className="font-bold text-sm">{delayedCases.length}</span>
            </div>

            {/* Aguardando faturamento */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#FEF3C7] text-amber-600 border border-amber-100">
              <div className="flex items-center gap-2">
                <DollarSign size={15} />
                <span className="text-xs font-semibold">Casos aguardando pagamento</span>
              </div>
              <span className="font-bold text-sm">{awaitingPaymentCount}</span>
            </div>

            {/* Aguardando análise */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#DBEAFE] text-blue-600 border border-blue-100">
              <div className="flex items-center gap-2">
                <Clock size={15} />
                <span className="text-xs font-semibold">Casos aguardando análise</span>
              </div>
              <span className="font-bold text-sm">{awaitingAnalysisCount}</span>
            </div>

            {/* Casos finalizados */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#DCFCE7] text-[#0F766E] border border-emerald-100">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} />
                <span className="text-xs font-semibold">Casos finalizados no mês</span>
              </div>
              <span className="font-bold text-sm">{finishedCasesCount}</span>
            </div>
          </div>
        </div>

        {/* Fila de Produção / Prioridade */}
        <div className="glass-panel p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2.5">
            <h4 className="font-bold text-sm text-slate-900">Fila de Produção e Prazos</h4>
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Ordenado por data limite</span>
          </div>
          
          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Dentista</th>
                  <th className="p-3 text-center">Tempo Est.</th>
                  <th className="p-3">Data Limite</th>
                  <th className="p-3 text-right">Prioridade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {productionQueue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                      Fila de produção vazia no momento.
                    </td>
                  </tr>
                ) : (
                  productionQueue.slice(0, 7).map(c => {
                    const dentist = dentists.find(d => d.id === c.dentist_id);
                    const badgeStyle = getPriorityColor(c);
                    return (
                      <tr 
                        key={c.id} 
                        onClick={() => onSelectCase && onSelectCase(c.id)}
                        className="hover:bg-slate-50/70 transition-all cursor-pointer"
                      >
                        <td className="p-3 font-semibold text-slate-800 font-mono text-[10px]">{c.id}</td>
                        <td className="p-3 font-bold text-slate-900">{c.patient_name}</td>
                        <td className="p-3 text-slate-600 font-medium">{dentist?.full_name}</td>
                        <td className="p-3 text-center text-slate-600 font-medium">
                          {formatEstimatedTime(c.estimated_hours)}
                        </td>
                        <td className="p-3 text-slate-600">
                          {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                            {getPriorityText(c)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
