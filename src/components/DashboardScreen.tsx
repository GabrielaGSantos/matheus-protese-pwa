import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, Profile } from '../types';
import { 
  DollarSign, Briefcase, Clock, AlertTriangle, 
  CheckCircle, ShieldAlert
} from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';
interface DashboardScreenProps {
  onSelectCase?: (caseId: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onSelectCase }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useRealtime('cases', () => {
    fetchData();
  });

  useEffect(() => {
    fetchData();
  }, []);

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
    .reduce((sum, c) => sum + c.value_matheus, 0);

  const monthlyReceived = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado';
    })
    .reduce((sum, c) => {
      const ratio = c.total_value > 0 ? c.paid_value / c.total_value : 0;
      return sum + (c.value_matheus * ratio);
    }, 0);

  const monthlyPending = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado';
    })
    .reduce((sum, c) => {
      const ratio = c.total_value > 0 ? c.remaining_value / c.total_value : 1;
      return sum + (c.value_matheus * ratio);
    }, 0);

  const otherMonthsPending = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && !c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado';
    })
    .reduce((sum, c) => {
      const ratio = c.total_value > 0 ? c.remaining_value / c.total_value : 1;
      return sum + (c.value_matheus * ratio);
    }, 0);

  const activeCasesCount = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && !['finalizado', 'entregue', 'cancelado'].includes(c.status);
  }).length;

  const finishedCasesCount = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && 
      c.created_at.startsWith(currentMonthStr) && 
      ['finalizado', 'entregue'].includes(c.status);
  }).length;

  const awaitingPaymentCount = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && (c.financial_status === 'aguardando_pagamento' || c.financial_status === 'cobrar');
  }).length;

  const isUnapproved = (c: Case) => {
    const year = new Date(c.created_at).getFullYear();
    return year >= 2026 && 
      (c.status === 'em_analise' || c.status === 'recebido' || c.status === 'aguardando_arquivos') && 
      c.dentist_id !== 'admin-1' && 
      c.dentist_id !== 'sec-1';
  };

  const unapprovedCases = cases.filter(isUnapproved);
  const awaitingAnalysisCount = unapprovedCases.length;

  // Delayed cases (only 2026 onwards)
  const delayedCases = cases.filter(c => {
    const year = new Date(c.created_at).getFullYear();
    const limitDate = c.final_delivery_date || c.requested_delivery_date;
    return year >= 2026 &&
      limitDate && 
      limitDate < todayStr && 
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
      const dateA = a.final_delivery_date || a.requested_delivery_date || '';
      const dateB = b.final_delivery_date || b.requested_delivery_date || '';
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB);
    });

  // Capacity calculations: sum estimated hours of active cases (only 2026 onwards)
  const totalEstimatedHours = cases
    .filter(c => {
      const year = new Date(c.created_at).getFullYear();
      return year >= 2026 && !['finalizado', 'entregue', 'cancelado'].includes(c.status);
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
    const limitDate = caseItem.final_delivery_date || caseItem.requested_delivery_date;
    if (!limitDate) return 'text-slate-400 bg-slate-50 border-slate-100';
    const diffTime = new Date(limitDate + 'T00:00:00').getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-rose-600 bg-[#FEE2E2] border-rose-100';
    if (diffDays <= 2) return 'text-amber-600 bg-[#FEF3C7] border-amber-100';
    return 'text-[#0F766E] bg-[#ECFDF5] border-emerald-100';
  };

  const getPriorityText = (caseItem: Case) => {
    const limitDate = caseItem.final_delivery_date || caseItem.requested_delivery_date;
    if (!limitDate) return 'Sem Prazo';
    const diffTime = new Date(limitDate + 'T00:00:00').getTime() - new Date(todayStr).getTime();
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
              <p className="opacity-90 font-medium text-[11px] mt-0.5">{totalEstimatedHours.toFixed(2)}h de produção ativa (Máx: 44h/semana)</p>
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
                          {(() => {
                            const limitDate = c.final_delivery_date || c.requested_delivery_date;
                            return limitDate ? new Date(limitDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'A definir';
                          })()}
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
