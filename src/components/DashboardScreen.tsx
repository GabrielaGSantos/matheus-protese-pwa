import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, Profile } from '../types';
import { 
  DollarSign, Briefcase, Clock, AlertTriangle, 
  CheckCircle, ShieldAlert, TrendingUp
} from 'lucide-react';

interface DashboardScreenProps {
  onSelectCase?: (caseId: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onSelectCase }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

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
    return <div className="text-center py-12 text-muted-foreground">Carregando painel de controle...</div>;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

  // KPI Calculations
  const totalInOpen = cases
    .filter(c => c.financial_status !== 'pago' && c.financial_status !== 'isento' && c.status !== 'cancelado')
    .reduce((sum, c) => sum + c.remaining_value, 0);

  const totalPaidMonth = cases
    .filter(c => c.financial_status === 'pago' || c.financial_status === 'pago_parcial')
    // Filter cases that belong to this month or were created/updated this month
    .filter(c => c.created_at.startsWith(currentMonthStr))
    .reduce((sum, c) => sum + c.paid_value, 0);

  const matheusRendimento = cases
    .filter(c => c.created_at.startsWith(currentMonthStr) && c.status !== 'cancelado')
    .reduce((sum, c) => sum + c.value_matheus, 0);

  const activeCasesCount = cases.filter(c => 
    !['finalizado', 'entregue', 'cancelado'].includes(c.status)
  ).length;

  const finishedCasesCount = cases.filter(c => c.status === 'finalizado').length;
  
  const awaitingPaymentCount = cases.filter(c => c.financial_status === 'aguardando_pagamento').length;

  const isUnapproved = (c: Case) => 
    (c.status === 'em_analise' || c.status === 'recebido') && 
    c.dentist_id !== 'admin-1' && 
    c.dentist_id !== 'sec-1';

  const unapprovedCases = cases.filter(isUnapproved);

  const awaitingAnalysisCount = unapprovedCases.length;

  // Delayed cases: final_delivery_date is in the past AND case is not finished/delivered
  const delayedCases = cases.filter(c => 
    c.final_delivery_date && 
    c.final_delivery_date < todayStr && 
    !['finalizado', 'entregue', 'cancelado'].includes(c.status) &&
    !isUnapproved(c)
  );

  // Production queue: active cases sorted by final delivery date
  const productionQueue = cases
    .filter(c => !['finalizado', 'entregue', 'cancelado'].includes(c.status) && !isUnapproved(c))
    .sort((a, b) => {
      if (!a.final_delivery_date) return 1;
      if (!b.final_delivery_date) return -1;
      return a.final_delivery_date.localeCompare(b.final_delivery_date);
    });

  // Capacity calculations: sum estimated hours of active cases
  const totalEstimatedHours = cases
    .filter(c => !['finalizado', 'entregue', 'cancelado'].includes(c.status) && !isUnapproved(c))
    .reduce((sum, c) => sum + c.estimated_hours, 0);

  // Weekly available capacity is 44 hours. Alert if active hours exceed 44h.
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
    if (!caseItem.final_delivery_date) return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    const diffTime = new Date(caseItem.final_delivery_date).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-rose-500 bg-rose-500/10 border-rose-500/20'; // Atrasado
    if (diffDays <= 2) return 'text-amber-500 bg-amber-500/10 border-amber-500/20'; // Urgente (0 a 2 dias)
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'; // Dentro do prazo
  };

  const getPriorityText = (caseItem: Case) => {
    if (!caseItem.final_delivery_date) return 'Sem Prazo';
    const diffTime = new Date(caseItem.final_delivery_date).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Atrasado';
    if (diffDays <= 2) return 'Urgente';
    return 'No Prazo';
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Info */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Painel do Dr. Matheus</h2>
          <p className="text-muted-foreground text-sm">
            Bem-vindo de volta! Resumo financeiro e fluxo de produção para o mês atual.
          </p>
        </div>
        
        {/* Overload status banner */}
        <div className={`p-4 rounded-2xl border flex items-center gap-3 w-fit ${
          isOverloaded 
            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        }`}>
          <span>
            {isOverloaded ? <ShieldAlert size={20} /> : <CheckCircle size={20} />}
          </span>
          <div className="text-xs">
            <h5 className="font-bold uppercase tracking-wider">{isOverloaded ? 'Alerta de Sobrecarga' : 'Capacidade Normal'}</h5>
            <p className="font-semibold opacity-90">{totalEstimatedHours}h de produção acumulada (Máx: 44h/semana)</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: Total em Aberto */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Em Aberto</span>
            <h3 className="text-2xl font-black text-foreground">R$ {totalInOpen.toFixed(2)}</h3>
            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp size={10} className="text-emerald-500" />
              Soma de pendências ativas
            </p>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <DollarSign size={24} />
          </div>
        </div>

        {/* KPI: Pago no Mês */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pago no Mês</span>
            <h3 className="text-2xl font-black text-emerald-500">R$ {totalPaidMonth.toFixed(2)}</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Faturamento recebido em {currentMonthStr}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <DollarSign size={24} />
          </div>
        </div>

        {/* KPI: Rendimento Matheus */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Lucro Dr. Matheus</span>
            <h3 className="text-2xl font-black text-primary">R$ {matheusRendimento.toFixed(2)}</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Fração Matheus no mês</p>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-xl text-primary">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* KPI: Casos Ativos */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Casos em Execução</span>
            <h3 className="text-2xl font-black text-foreground">{activeCasesCount} Casos</h3>
            <p className="text-[10px] text-muted-foreground font-medium">Total na fila de produção</p>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
            <Briefcase size={24} />
          </div>
        </div>

      </div>

      {/* Novas Solicitações (Aguardando Aprovação) */}
      {unapprovedCases.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                Novas Solicitações de Clientes (Aguardando Aprovação)
              </h4>
              <p className="text-xs text-muted-foreground">
                Casos enviados por dentistas parceiros que precisam ser aprovados para entrar na fila de produção.
              </p>
            </div>
            <span className="text-xs font-bold bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-lg">
              {unapprovedCases.length} Pendente{unapprovedCases.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unapprovedCases.map(c => {
              const dentist = dentists.find(d => d.id === c.dentist_id);
              return (
                <div 
                  key={c.id} 
                  onClick={() => onSelectCase && onSelectCase(c.id)}
                  className="p-4 rounded-xl bg-card border border-white/10 hover:border-amber-500/40 hover:bg-secondary/20 transition-all cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm text-foreground">{c.patient_name}</span>
                      <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono">
                        {c.id}
                      </span>
                    </div>
                    <div className="text-xs text-primary font-semibold">
                      Dr(a). {dentist?.full_name || 'Desconhecido'}
                    </div>
                    {c.requested_delivery_date && (
                      <div className="text-[10px] text-muted-foreground">
                        Prazo Solicitado: <span className="font-semibold text-foreground">{new Date(c.requested_delivery_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                    {c.dentist_notes && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                        "{c.dentist_notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={(e) => handleApproveCase(e, c)}
                      className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-primary/10"
                    >
                      <CheckCircle size={14} />
                      Aprovar Caso
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Production Warning / Stats Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Warning cards / Quick stats */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
          <h4 className="font-bold text-base text-foreground">Alertas Odontológicos</h4>
          
          <div className="space-y-3">
            {/* Casos em atraso */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} />
                <span className="text-xs font-semibold">Casos em atraso</span>
              </div>
              <span className="font-extrabold text-sm">{delayedCases.length}</span>
            </div>

            {/* Aguardando pagamento */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <div className="flex items-center gap-2.5">
                <DollarSign size={18} />
                <span className="text-xs font-semibold">Casos aguardando pagamento</span>
              </div>
              <span className="font-extrabold text-sm">{awaitingPaymentCount}</span>
            </div>

            {/* Aguardando análise */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <div className="flex items-center gap-2.5">
                <Clock size={18} />
                <span className="text-xs font-semibold">Casos aguardando análise</span>
              </div>
              <span className="font-extrabold text-sm">{awaitingAnalysisCount}</span>
            </div>

            {/* Casos finalizados */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <CheckCircle size={18} />
                <span className="text-xs font-semibold">Casos finalizados no mês</span>
              </div>
              <span className="font-extrabold text-sm">{finishedCasesCount}</span>
            </div>
          </div>
        </div>

        {/* Fila de Produção / Prioridade */}
        <div className="glass-panel p-5 rounded-2xl border border-white/5 lg:col-span-2 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-base text-foreground">Fila de Confecção / Prioridade</h4>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Ordenado por Prazo</span>
            </div>
            
            <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
              {productionQueue.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs border border-dashed border-white/5 rounded-xl">
                  Fila de produção vazia no momento.
                </div>
              ) : (
                productionQueue.map(c => {
                  const dentist = dentists.find(d => d.id === c.dentist_id);
                  const badgeStyle = getPriorityColor(c);
                  return (
                    <div 
                      key={c.id} 
                      onClick={() => onSelectCase && onSelectCase(c.id)}
                      className="p-3 rounded-xl bg-secondary/35 border border-white/5 flex items-center justify-between hover:bg-secondary/65 hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground">{c.patient_name}</span>
                          <span className="text-[10px] text-primary font-medium">{dentist?.full_name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          ID: {c.id} • Horas estimadas: {c.estimated_hours}h
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Entrega</span>
                          <span className="text-xs font-bold text-foreground">
                            {c.final_delivery_date ? new Date(c.final_delivery_date).toLocaleDateString('pt-BR') : 'A definir'}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-widest ${badgeStyle}`}>
                          {getPriorityText(c)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
