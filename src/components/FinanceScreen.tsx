import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { notificationService } from '../services/notifications';
import type { Case, Profile, Service } from '../types';
import { 
  ChevronDown, ChevronUp, Copy, Check, MessageSquare, 
  TrendingUp, ShieldCheck, X, Download, CalendarRange 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useRealtime } from '../hooks/useRealtime';

export const FinanceScreen: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [activeTab, setActiveTab] = useState<'billing' | 'reports' | 'monthly_status' | 'andrey_costs'>('billing');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [expandedDentistId, setExpandedDentistId] = useState<string | null>(null);
  const [showAllOutstanding, setShowAllOutstanding] = useState(false);
  const [statusDentistFilter, setStatusDentistFilter] = useState('todos');

  // Payment modal state
  const [payingCase, setPayingCase] = useState<Case | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(true);

  // Clipboard feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selection state for finance batch conciliation
  const [selectedFinanceCaseIds, setSelectedFinanceCaseIds] = useState<Record<string, boolean>>({});

  useRealtime('cases', () => {
    fetchData();
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const c = await api.cases.list('admin', 'admin-1');
      const p = await api.profiles.list();
      const s = await api.services.list();
      setCases(c);
      setDentists(p.filter(x => x.role === 'dentist'));
      setServices(s);
    } catch (err) {
      console.error(err);
    }
  };

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

  const getFeitoPor = (internalNotes?: string) => {
    if (!internalNotes) return '';
    const match = internalNotes.match(/Feito por:\s*(.*)/i);
    return match ? match[1].trim() : '';
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCase) return;

    try {
      const amt = isFullPayment ? payingCase.remaining_value : parseFloat(payAmount) || 0;
      const newPaidValue = payingCase.paid_value + amt;
      const newRemainingValue = Math.max(0, payingCase.total_value - newPaidValue);
      
      const newFinStatus = newPaidValue >= payingCase.total_value 
        ? 'pago' 
        : newPaidValue > 0 ? 'pago_parcial' : 'cobrar';

      const updatedCase: Case = {
        ...payingCase,
        paid_value: newPaidValue,
        remaining_value: newRemainingValue,
        financial_status: newFinStatus as any,
        payment_receipt_url: receiptUrl || undefined,
        updated_at: new Date().toISOString()
      };

      await api.cases.save(updatedCase, 'admin-1');
      setPayingCase(null);
      setPayAmount('');
      setReceiptUrl('');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkPaymentFinance = async (pendingCasesToPay: Case[]) => {
    if (pendingCasesToPay.length === 0) return;
    if (!window.confirm(`Deseja dar baixa (quitação total) nos ${pendingCasesToPay.length} caso(s) selecionado(s)?`)) {
      return;
    }
    try {
      for (const c of pendingCasesToPay) {
        const updatedCase: Case = {
          ...c,
          paid_value: c.total_value,
          remaining_value: 0,
          financial_status: 'pago',
          updated_at: new Date().toISOString()
        };
        await api.cases.save(updatedCase, 'admin-1');
      }
      alert(`✅ Baixa registrada com sucesso para ${pendingCasesToPay.length} caso(s)!`);
      setSelectedFinanceCaseIds({});
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar pagamento em lote.');
    }
  };

  const handleBulkRelease = async (casesToRelease: Case[]) => {
    if (casesToRelease.length === 0) return;
    try {
      for (const c of casesToRelease) {
        const updatedCase: Case = {
          ...c,
          financial_released: true,
          updated_at: new Date().toISOString()
        };
        await api.cases.save(updatedCase, 'admin-1');
      }
      setSelectedFinanceCaseIds({});
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao liberar casos em lote.');
    }
  };

  const handleToggleRelease = async (c: Case) => {
    try {
      const updatedCase: Case = {
        ...c,
        financial_released: !c.financial_released,
        updated_at: new Date().toISOString()
      };
      await api.cases.save(updatedCase, 'admin-1');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro ao alterar liberação do caso.');
    }
  };

  const getFinancialBadge = (status: string) => {
    const notifSettings = notificationService.getSettings();
    const finStatuses = notifSettings.custom_financial_statuses || [
      { id: 'cobrar', label: 'Cobrar', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
      { id: 'aguardando_pagamento', label: 'Aguardando Pagamento', colorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
      { id: 'pago_parcial', label: 'Pago Parcial', colorClass: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
      { id: 'pago', label: 'Pago', colorClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
      { id: 'isento', label: 'Isento', colorClass: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
      { id: 'cancelado', label: 'Cancelado', colorClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' }
    ];
    const customMatch = finStatuses.find(s => s.id === status);
    const style = customMatch ? customMatch.colorClass : 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    const label = customMatch ? customMatch.label : status.replace('_', ' ');
    if (customMatch?.hexColor) {
      return (
        <span 
          className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full border whitespace-nowrap"
          style={{ backgroundColor: `${customMatch.hexColor}1A`, color: customMatch.hexColor, borderColor: `${customMatch.hexColor}33` }}
        >
          {label}
        </span>
      );
    }
    return (
      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full border whitespace-nowrap ${style}`}>
        {label}
      </span>
    );
  };

  const handleToggleExpand = (dentistId: string, pendingCases: Case[]) => {
    if (expandedDentistId === dentistId) {
      setExpandedDentistId(null);
    } else {
      setExpandedDentistId(dentistId);
      // Marca todos os casos pendentes desse dentista como selecionados por padrão
      const initialSelection: Record<string, boolean> = {};
      pendingCases.forEach(c => {
        initialSelection[c.id] = true;
      });
      setSelectedFinanceCaseIds(initialSelection);
    }
  };

  // Generate WhatsApp Message
  const getWhatsAppText = (dentist: Profile, pendingCases: Case[], andreyDiscountCredit: number = 0) => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const [year, month] = selectedMonth.split('-');
    const monthLabel = `${monthNames[parseInt(month) - 1]} de ${year}`;
    
    let totalOpen = 0;
    let totalMatheus = 0;
    let totalPlanning = 0;
    let totalPaschoal = 0;
    let itemsText = '';
    
    pendingCases.forEach((c) => {
      // Build service description with element count
      const serviceNames = getServiceNames(c);
      const elemCount = c.teeth_selection.teeth.length;
      const serviceDesc = elemCount > 0
        ? `Serviço: ${serviceNames}\n  Elementos: ${elemCount}`
        : `Serviço: ${serviceNames}`;

      const dateObj = new Date(c.created_at);
      const formattedDate = !isNaN(dateObj.getTime())
        ? ` [${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}]`
        : '';
      itemsText += `• Paciente: ${c.patient_name}${formattedDate} — R$ ${c.remaining_value.toFixed(2)}\n  ${serviceDesc}\n\n`;
      totalOpen += c.remaining_value;
      totalMatheus += c.value_matheus;
      totalPlanning += c.value_planning || 0;
      totalPaschoal += c.value_paschoal;
    });

    // Read configured PIX keys
    const globalSettings = notificationService.getSettings();
    const pixMatheus = globalSettings.pix_matheus || dentist.pix_key || 'matheus@pix.com';
    const pixPlanning = globalSettings.pix_planning || '';
    const pixPaschoal = globalSettings.pix_paschoal || '';

    let totalOpenText = '';
    if (andreyDiscountCredit > 0) {
      const finalOpen = Math.max(0, totalOpen - andreyDiscountCredit);
      totalOpenText = `Subtotal em aberto: R$ ${totalOpen.toFixed(2)}\nDesconto de Créditos (Repasse Andrey): -R$ ${andreyDiscountCredit.toFixed(2)}\nTotal com Desconto: *R$ ${finalOpen.toFixed(2)}*`;
    } else {
      totalOpenText = `Total em aberto: *R$ ${totalOpen.toFixed(2)}*`;
    }

    // Build PIX section
    let pixSection = '';
    const hasMatheusValue = totalMatheus > 0;
    const hasPlanningValue = totalPlanning > 0 && pixPlanning;
    const hasPaschoalValue = totalPaschoal > 0 && pixPaschoal;

    const sections = [];
    if (hasMatheusValue) sections.push(`Pix Dr. Matheus: *${pixMatheus}*\n  Valor: R$ ${totalMatheus.toFixed(2)}`);
    if (hasPlanningValue) sections.push(`Pix Planning: *${pixPlanning}*\n  Valor: R$ ${totalPlanning.toFixed(2)}`);
    if (hasPaschoalValue) sections.push(`Pix Dr. Paschoal: *${pixPaschoal}*\n  Valor: R$ ${totalPaschoal.toFixed(2)}`);

    if (sections.length > 1) {
      pixSection = sections.join('\n');
    } else if (hasPaschoalValue && !hasMatheusValue && !hasPlanningValue) {
      pixSection = `Pix para pagamento: *${pixPaschoal}*`;
    } else if (hasPlanningValue && !hasMatheusValue && !hasPaschoalValue) {
      pixSection = `Pix para pagamento: *${pixPlanning}*`;
    } else {
      pixSection = `Pix para pagamento: *${pixMatheus}*`;
    }

    return `Olá, Dr(a). ${dentist.full_name.replace('Dr. ', '').replace('Dra. ', '')}! Segue o fechamento dos casos em aberto:\n\n${itemsText}${totalOpenText}\n\n${pixSection}\nFavor enviar o comprovante após a transação. Obrigado!`;
  };

  const handleCopyText = (text: string, dentistId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(dentistId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Dentist remaining balance calculations
  const getDentistsWithBalances = () => {
    return dentists.map(d => {
      // filter cases of this dentist that belong to selected month and are active
      const dentistCases = cases.filter(c => {
        if (c.dentist_id !== d.id || c.status === 'cancelado') return false;
        
        // Include cases of the selected month
        if (c.created_at.startsWith(selectedMonth)) return true;
        
        // Include outstanding cases from other months if enabled
        if (showAllOutstanding && c.financial_status !== 'pago' && c.financial_status !== 'isento' && c.remaining_value > 0) {
          return true;
        }
        
        return false;
      });
      
      const pendingCases = dentistCases.filter(c => c.financial_status !== 'pago' && c.financial_status !== 'isento');
      const totalPending = pendingCases.reduce((sum, c) => sum + c.value_matheus, 0);
      const totalBilled = dentistCases.filter(c => c.created_at.startsWith(selectedMonth)).reduce((sum, c) => sum + c.total_value, 0);

      // Calculate total credit discount for Dr. Andrey
      let andreyDiscountCredit = 0;
      const isAndrey = d.full_name.toLowerCase().includes('andrey');
      if (isAndrey) {
        // Find all cases that have cost_andrey_discounted === true
        const discountedCases = cases.filter(c => {
          if (c.status === 'cancelado' || !c.cost_andrey_discounted) return false;
          if (c.created_at.startsWith(selectedMonth)) return true;
          if (showAllOutstanding && c.financial_status !== 'pago' && c.financial_status !== 'isento') return true;
          return false;
        });
        andreyDiscountCredit = discountedCases.reduce((sum, c) => sum + (c.cost_andrey || 0), 0);
      }

      return {
        dentist: d,
        totalBilled,
        totalPending: Math.max(0, totalPending - andreyDiscountCredit),
        pendingCases,
        allCases: dentistCases,
        andreyDiscountCredit
      };
    }).filter(x => x.allCases.length > 0 || x.andreyDiscountCredit > 0) // show Dr. Andrey even if he has no cases but has credit
      .sort((a, b) => b.totalPending - a.totalPending);
  };

  // Report calculations for selected month
  const getReportSummary = () => {
    const monthCases = cases.filter(c => c.created_at.startsWith(selectedMonth) && c.status !== 'cancelado');
    
    const billedTotal = monthCases.reduce((sum, c) => sum + c.total_value, 0);
    const paidTotal = monthCases.reduce((sum, c) => sum + c.paid_value, 0);
    const openTotal = monthCases.reduce((sum, c) => sum + c.remaining_value, 0);
    
    const matheusBillings = monthCases.reduce((sum, c) => sum + c.value_matheus, 0);
    const planningBillings = monthCases.reduce((sum, c) => sum + (c.value_planning || 0), 0);
    const paschoalBillings = monthCases.reduce((sum, c) => sum + c.value_paschoal, 0);

    const costAndreyTotal = monthCases.reduce((sum, c) => sum + (c.cost_andrey || 0), 0);
    const otherCostsTotal = monthCases.reduce((sum, c) => {
      const caseOther = c.other_internal_costs || [];
      const caseOtherSum = caseOther.reduce((s, o) => s + (o.value || 0), 0);
      return sum + caseOtherSum;
    }, 0);

    const internalCosts = costAndreyTotal + otherCostsTotal;
    const netProfit = matheusBillings - internalCosts;

    return {
      billedTotal,
      paidTotal,
      openTotal,
      matheusBillings,
      planningBillings,
      paschoalBillings,
      costAndreyTotal,
      otherCostsTotal,
      internalCosts,
      netProfit
    };
  };

  const handleExportCSV = () => {
    const monthCases = cases.filter(c => c.created_at.startsWith(selectedMonth) && c.status !== 'cancelado');
    
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += `Data Recebido;Data Entrega;Feito por;Cliente;Paciente;Tipo;Valor Matheus;Valor Planning;Valor Paschoal;Valor Total;Status;Elementos;Observações\n`;

    monthCases.forEach(c => {
      const dataRecebido = new Date(c.created_at).toLocaleDateString('pt-BR');
      const dataEntrega = c.final_delivery_date ? new Date(c.final_delivery_date + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      const feitoPor = getFeitoPor(c.internal_notes);
      const cliente = dentists.find(d => d.id === c.dentist_id)?.full_name || 'Desconhecido';
      const paciente = c.patient_name;
      const tipo = getServiceNames(c);
      const valMatheus = c.value_matheus.toFixed(2).replace('.', ',');
      const valPlanning = c.value_planning.toFixed(2).replace('.', ',');
      const valPaschoal = c.value_paschoal.toFixed(2).replace('.', ',');
      const valTotal = c.total_value.toFixed(2).replace('.', ',');
      const statusText = c.status === 'em_analise' ? 'Aguardando Análise' : c.status;
      const elementos = c.teeth_selection.teeth.join(', ');
      const observacoes = c.dentist_notes || '';

      csvContent += `${dataRecebido};${dataEntrega};${feitoPor};${cliente};${paciente};${tipo};${valMatheus};${valPlanning};${valPaschoal};${valTotal};${statusText};${elementos};${observacoes}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_financeiro_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = getReportSummary();
  const dentistsBalances = getDentistsWithBalances();

  // Revenue chart data with date range filter
  const [chartStartDate, setChartStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return d.toISOString().slice(0, 7);
  });
  const [chartEndDate, setChartEndDate] = useState(() => new Date().toISOString().slice(0, 7));

  const revenueChartData = useMemo(() => {
    const monthNames = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    const start = new Date(chartStartDate + '-01');
    const end = new Date(chartEndDate + '-01');
    const data: { name: string; matheus: number; paschoal: number; total: number }[] = [];

    const current = new Date(start);
    while (current <= end) {
      const ym = current.toISOString().slice(0, 7);
      const monthCases = cases.filter(c => c.created_at.startsWith(ym) && c.status !== 'cancelado');

      const matheus = monthCases.reduce((s, c) => s + c.value_matheus, 0);
      const paschoal = monthCases.reduce((s, c) => s + c.value_paschoal, 0);
      const total = monthCases.reduce((s, c) => s + c.total_value, 0);

      data.push({
        name: `${monthNames[current.getMonth()]}/${String(current.getFullYear()).slice(2)}`,
        matheus,
        paschoal,
        total
      });

      current.setMonth(current.getMonth() + 1);
    }
    return data;
  }, [cases, chartStartDate, chartEndDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Módulo Financeiro</h2>
          <p className="text-slate-500 text-xs mt-1">
            Visualize o fluxo de caixa do laboratório, fechamentos por dentista e gere mensagens de cobrança.
          </p>
        </div>

        {/* Month Selector and Checkbox */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Competência:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-all-outstanding"
              checked={showAllOutstanding}
              onChange={(e) => setShowAllOutstanding(e.target.checked)}
              className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300 cursor-pointer"
            />
            <label htmlFor="show-all-outstanding" className="text-[10px] font-semibold text-slate-500 cursor-pointer select-none">
              Incluir atrasados de outros meses
            </label>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] w-full gap-6 pb-px">
        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'billing'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Fechamentos & Cobrança
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Relatório Geral do Mês
        </button>
        <button
          onClick={() => setActiveTab('monthly_status')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'monthly_status'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Status dos Casos (Pago vs Aberto)
        </button>
        <button
          onClick={() => setActiveTab('andrey_costs')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'andrey_costs'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Repasse Dr. Andrey
        </button>
      </div>

      {activeTab === 'billing' ? (
        /* BILLING AND COBRANCAS TAB */
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-slate-900">Dentistas com Casos Ativos no Mês</h3>
          
          <div className="space-y-3">
            {dentistsBalances.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-[#E2E8F0] rounded-xl">
                Nenhum faturamento registrado para a competência selecionada.
              </div>
            ) : (
              dentistsBalances.map(({ dentist, totalBilled, totalPending, pendingCases, andreyDiscountCredit }) => {
                const isExpanded = expandedDentistId === dentist.id;
                const whatsappText = getWhatsAppText(dentist, pendingCases, andreyDiscountCredit);
                
                return (
                  <div key={dentist.id} className="glass-panel overflow-hidden transition-all">
                    
                    {/* Dentist Header Card */}
                    <div 
                      onClick={() => handleToggleExpand(dentist.id, pendingCases)}
                      className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-all"
                    >
                      <div className="space-y-0.5">
                        <h4 className="font-semibold text-sm text-slate-900">{dentist.full_name}</h4>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Total faturado no mês: R$ {totalBilled.toFixed(2)}
                        </span>
                        {andreyDiscountCredit > 0 && (
                          <span className="text-[11px] text-emerald-600 font-semibold block">
                            Créditos de Repasse Andrey: -R$ {andreyDiscountCredit.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Pendente</span>
                          <span className={`text-sm font-bold ${totalPending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            R$ {totalPending.toFixed(2)}
                          </span>
                        </div>
                        <span className="p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </div>
                    </div>

                    {/* Dentist Expanded cases / WhatsApp generator */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50 border-t border-[#E2E8F0] space-y-4 animate-fade-in">
                        
                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2 items-center justify-between">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopyText(whatsappText, dentist.id)}
                              className="px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[10px] font-semibold rounded-lg flex items-center gap-1.5 transition-all"
                            >
                              {copiedId === dentist.id ? <Check size={12} /> : <Copy size={12} />}
                              {copiedId === dentist.id ? 'Copiado!' : 'Copiar Mensagem'}
                            </button>
                            
                            {dentist.whatsapp && (
                              <a
                                href={`https://wa.me/55${dentist.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-[10px] font-semibold rounded-lg flex items-center gap-1.5 transition-all"
                              >
                                <MessageSquare size={12} className="text-emerald-500" />
                                Enviar WhatsApp
                              </a>
                            )}
                          </div>

                          {pendingCases.filter(c => selectedFinanceCaseIds[c.id]).length > 0 && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const selectedCases = pendingCases.filter(c => selectedFinanceCaseIds[c.id]);
                                  handleBulkRelease(selectedCases);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer animate-fade-in"
                              >
                                <ShieldCheck size={12} />
                                Liberar em Lote ({pendingCases.filter(c => selectedFinanceCaseIds[c.id]).length})
                              </button>
                              <button
                                onClick={() => {
                                  const selectedCases = pendingCases.filter(c => selectedFinanceCaseIds[c.id]);
                                  handleBulkPaymentFinance(selectedCases);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer animate-fade-in"
                              >
                                <Check size={12} />
                                Dar Baixa em Lote ({pendingCases.filter(c => selectedFinanceCaseIds[c.id]).length})
                              </button>
                            </div>
                          )}
                        </div>

                        {/* List of expanded dentist's cases */}
                        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <tr>
                                <th className="p-3 w-8">
                                  <input
                                    type="checkbox"
                                    checked={pendingCases.length > 0 && pendingCases.every(c => selectedFinanceCaseIds[c.id])}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const nextSelection = { ...selectedFinanceCaseIds };
                                      pendingCases.forEach(c => {
                                        if (checked) {
                                          nextSelection[c.id] = true;
                                        } else {
                                          delete nextSelection[c.id];
                                        }
                                      });
                                      setSelectedFinanceCaseIds(nextSelection);
                                    }}
                                    className="w-3.5 h-3.5 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300 cursor-pointer"
                                  />
                                </th>
                                <th className="p-3">ID do Caso</th>
                                <th className="p-3">Paciente</th>
                                <th className="p-3">Status Clínico</th>
                                <th className="p-3">Status Financeiro</th>
                                <th className="p-3">Total</th>
                                <th className="p-3">Pago</th>
                                <th className="p-3">Aberto</th>
                                <th className="p-3 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                               {pendingCases.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="p-4 text-center text-[#94A3B8] text-xs font-semibold">
                                    {showAllOutstanding ? 'Todos os casos deste período já estão quitados!' : 'Todos os casos deste mês já estão quitados!'}
                                  </td>
                                </tr>
                              ) : (
                                pendingCases.map(c => (
                                  <tr key={c.id} className="hover:bg-slate-50/70 transition-all">
                                    <td className="p-3">
                                      <input
                                        type="checkbox"
                                        checked={!!selectedFinanceCaseIds[c.id]}
                                        onChange={() => {
                                          setSelectedFinanceCaseIds(prev => {
                                            const next = { ...prev };
                                            if (next[c.id]) {
                                              delete next[c.id];
                                            } else {
                                              next[c.id] = true;
                                            }
                                            return next;
                                          });
                                        }}
                                        className="w-3.5 h-3.5 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300 cursor-pointer"
                                      />
                                    </td>
                                    <td className="p-3 font-semibold text-slate-800 font-mono text-[11px]">{c.id}</td>
                                    <td className="p-3 font-semibold text-slate-900">{c.patient_name}</td>
                                    <td className="p-3">
                                      <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-bold text-[9px] uppercase tracking-wide text-slate-600">
                                        {c.status}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex flex-col gap-1.5 items-start">
                                        {getFinancialBadge(c.financial_status)}
                                        {c.financial_released && (
                                          <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                            Liberado
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-bold text-slate-900">R$ {c.total_value.toFixed(2)}</div>
                                      {(c.value_paschoal > 0 || c.value_planning > 0) && (
                                        <div className="text-[9px] text-slate-500 font-normal mt-0.5 space-y-0.5 whitespace-nowrap">
                                          {c.value_matheus > 0 && <div>Matheus: R$ {c.value_matheus.toFixed(2)}</div>}
                                          {c.value_paschoal > 0 && <div>Paschoal: R$ {c.value_paschoal.toFixed(2)}</div>}
                                          {c.value_planning > 0 && <div>Planning: R$ {c.value_planning.toFixed(2)}</div>}
                                        </div>
                                      )}
                                    </td>
                                    <td className={`p-3 font-semibold ${c.paid_value === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>R$ {c.paid_value.toFixed(2)}</td>
                                    <td className="p-3 font-semibold text-amber-600">R$ {c.remaining_value.toFixed(2)}</td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          onClick={() => handleToggleRelease(c)}
                                          className={`px-2.5 py-1 ${c.financial_released ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'} text-[10px] font-semibold rounded-md transition-all`}
                                        >
                                          {c.financial_released ? 'Bloquear Valor' : 'Liberar Valor'}
                                        </button>
                                        <button
                                          onClick={() => setPayingCase(c)}
                                          className="px-2.5 py-1 bg-[#0F766E] hover:bg-[#115E59] text-white text-[10px] font-semibold rounded-md transition-all"
                                        >
                                          Baixa Pagamento
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {andreyDiscountCredit > 0 && (
                          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-medium">
                            Desconto aplicado: R$ {andreyDiscountCredit.toFixed(2)} (créditos de repasse Andrey).
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Payment Conciliation Modal overlay */}
          {payingCase && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.08)] p-6 relative">
                <button
                  onClick={() => setPayingCase(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X size={16} />
                </button>

                <h3 className="text-sm font-bold text-slate-900 mb-1">Registrar Recebimento</h3>
                <p className="text-[11px] text-slate-500 mb-4">
                  Conciliação de pagamento para o paciente: <strong className="text-slate-700">{payingCase.patient_name}</strong>
                </p>

                <form onSubmit={handleRegisterPayment} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E2E8F0] space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Valor Total do Caso:</span>
                      <span className="font-bold text-slate-900">R$ {payingCase.total_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Valor já Pago:</span>
                      <span className="font-semibold text-emerald-600">R$ {payingCase.paid_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#E2E8F0]">
                      <span className="text-slate-600 font-semibold">Saldo em aberto:</span>
                      <span className="font-bold text-amber-600">R$ {payingCase.remaining_value.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 py-2 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="fullPay"
                        name="payType"
                        checked={isFullPayment}
                        onChange={() => setIsFullPayment(true)}
                        className="w-4 h-4 text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                      />
                      <label htmlFor="fullPay" className="text-xs font-medium text-slate-700 cursor-pointer">Quitação Total</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="partialPay"
                        name="payType"
                        checked={!isFullPayment}
                        onChange={() => setIsFullPayment(false)}
                        className="w-4 h-4 text-[#0F766E] focus:ring-[#0F766E] border-slate-300"
                      />
                      <label htmlFor="partialPay" className="text-xs font-medium text-slate-700 cursor-pointer">Pagamento Parcial</label>
                    </div>
                  </div>

                  {!isFullPayment && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                        Valor Recebido (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 font-semibold text-xs focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                      Comprovante / Link do Recibo (Opcional)
                    </label>
                    <input
                      type="text"
                      value={receiptUrl}
                      onChange={(e) => setReceiptUrl(e.target.value)}
                      placeholder="Link da imagem, PDF ou código de arquivo"
                      className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] text-xs focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayingCase(null)}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-3.5 py-2 rounded-lg text-xs transition-all"
                    >
                      Confirmar Pagamento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      ) : activeTab === 'reports' ? (
        /* GENERAL MONTHLY REPORT TAB */
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Métricas Detalhadas do Mês</h3>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Download size={14} />
              Exportar CSV
            </button>
          </div>
          
          {/* Card Summary indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Faturamento Bruto</span>
              <h3 className="text-xl font-bold text-slate-900">R$ {summary.billedTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-slate-400">Soma de todos os casos criados</p>
            </div>
            
            <div className="glass-panel p-5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Arrecadado (Quitado)</span>
              <h3 className="text-xl font-bold text-emerald-600">R$ {summary.paidTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-slate-400">Total de baixas de pagamento</p>
            </div>

            <div className="glass-panel p-5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">A Receber</span>
              <h3 className="text-xl font-bold text-amber-600">R$ {summary.openTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-slate-400">Saldo remanescente de devedores</p>
            </div>
          </div>

          {/* Profits & internal divisions detailed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Margins & comissions */}
            <div className="glass-panel p-5 space-y-4">
              <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-[#0F766E]" />
                Rendimentos Laboratoriais
              </h4>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-700">Fração Dr. Matheus</span>
                    <span className="text-[10px] text-slate-400 block">Projetos atribuídos ao Matheus</span>
                  </div>
                  <span className="font-bold text-sm text-slate-900">R$ {summary.matheusBillings.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-700">Fração Planning</span>
                    <span className="text-[10px] text-slate-400 block">Projetos atribuídos ao Planning</span>
                  </div>
                  <span className="font-bold text-sm text-slate-900">R$ {summary.planningBillings.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-700">Fração Dr. Paschoal</span>
                    <span className="text-[10px] text-slate-400 block">Projetos em parceria atribuídos</span>
                  </div>
                  <span className="font-bold text-sm text-slate-900">R$ {summary.paschoalBillings.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Internal Subcontract costs and Net Profit */}
            <div className="glass-panel p-5 space-y-4">
              <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                Custos Operacionais & Lucro Líquido
              </h4>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-700">Repasse Andrey</span>
                  </div>
                  <span className="font-semibold text-slate-900">R$ {summary.costAndreyTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-700">Outros Custos Internos</span>
                    <span className="text-[10px] text-slate-400 block">Soma de outros custos dinâmicos cadastrados</span>
                  </div>
                  <span className="font-semibold text-slate-900">R$ {summary.otherCostsTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-white border border-[#E2E8F0] text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900">Lucro Líquido Real (Dr. Matheus)</span>
                    <span className="text-[9px] font-semibold text-slate-400 uppercase block">Fração Matheus menos Custos Internos</span>
                  </div>
                  <span className="font-bold text-sm text-emerald-600">R$ {summary.netProfit.toFixed(2)}</span>
                </div>
              </div>
             </div>
 
           </div>

          {/* Revenue Chart */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-[#0F766E]" />
                Gráfico de Faturamento
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <CalendarRange size={14} className="text-slate-400" />
                <input
                  type="month"
                  value={chartStartDate}
                  onChange={(e) => setChartStartDate(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[10px] font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                />
                <span className="text-[10px] font-bold text-slate-400">até</span>
                <input
                  type="month"
                  value={chartEndDate}
                  onChange={(e) => setChartEndDate(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#E2E8F0] text-[10px] font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>
            </div>

            <div className="w-full" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} tickFormatter={(v: number) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      boxShadow: '0 4px 16px rgba(15,23,42,0.06)'
                    }}
                    formatter={(value: any, name: any) => {
                      const labels: Record<string, string> = {
                        matheus: 'Dr. Matheus',
                        paschoal: 'Dr. Paschoal',
                        total: 'Total Faturado'
                      };
                      return [`R$ ${value.toFixed(2)}`, labels[name] || name];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const labels: Record<string, string> = {
                        matheus: 'Dr. Matheus',
                        paschoal: 'Dr. Paschoal',
                        total: 'Total Faturado'
                      };
                      return labels[value] || value;
                    }}
                    wrapperStyle={{ fontSize: '10px', fontWeight: 700 }}
                  />
                  <Bar dataKey="matheus" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paschoal" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
 
         </div>
      ) : activeTab === 'monthly_status' ? (
        /* MONTHLY STATUS TAB */
        <div className="space-y-6 animate-fade-in">
          {/* Filtro de Dentista específico para esta aba */}
          <div className="flex items-center gap-2 pb-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60 max-w-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtrar por Dentista:</span>
            <select
              value={statusDentistFilter}
              onChange={(e) => setStatusDentistFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all cursor-pointer"
            >
              <option value="todos">Todos os Dentistas</option>
              {dentists.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* PAGOS */}
            {(() => {
              const paid = cases.filter(c => {
                const isMonth = c.created_at.startsWith(selectedMonth);
                const notCancelled = c.status !== 'cancelado';
                const isPaid = c.financial_status === 'pago' || c.financial_status === 'isento';
                const dentistMatch = statusDentistFilter === 'todos' || c.dentist_id === statusDentistFilter;
                return isMonth && notCancelled && isPaid && dentistMatch;
              });

              return (
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                      <ShieldCheck size={16} />
                      Casos Pagos / Isentos ({paid.length})
                    </h3>
                  </div>
                  
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {paid.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs italic">Nenhum caso pago este mês.</div>
                    ) : (
                      paid.map(c => {
                        const dentist = dentists.find(d => d.id === c.dentist_id);
                        return (
                          <div key={c.id} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <div className="font-bold text-slate-900">{c.patient_name}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                {dentist?.full_name} · <span className="font-mono">{c.id}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-600 block">R$ {c.total_value.toFixed(2)}</span>
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                                {c.financial_status}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* EM ABERTO */}
            {(() => {
              const pending = cases.filter(c => {
                const isMonth = c.created_at.startsWith(selectedMonth);
                const notCancelled = c.status !== 'cancelado';
                const isOpen = c.financial_status !== 'pago' && c.financial_status !== 'isento';
                const dentistMatch = statusDentistFilter === 'todos' || c.dentist_id === statusDentistFilter;
                return isMonth && notCancelled && isOpen && dentistMatch;
              });

              return (
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-amber-600 flex items-center gap-2">
                      <TrendingUp size={16} className="text-amber-500" />
                      Casos em Aberto / Pendentes ({pending.length})
                    </h3>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {pending.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs italic">Nenhum caso em aberto este mês.</div>
                    ) : (
                      pending.map(c => {
                        const dentist = dentists.find(d => d.id === c.dentist_id);
                        return (
                          <div key={c.id} className="p-3 bg-white border border-[#E2E8F0] rounded-xl flex justify-between items-center text-xs shadow-2xs hover:shadow-xs transition-all">
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="font-bold text-slate-900 truncate">{c.patient_name}</div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                {dentist?.full_name} · <span className="font-mono">{c.id}</span>
                              </div>
                              <div className="text-[9px] font-semibold text-slate-500 mt-1">
                                Pago: R$ {c.paid_value.toFixed(2)} / Resta: <span className="text-rose-600 font-bold">R$ {c.remaining_value.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className="font-bold text-slate-700">R$ {c.total_value.toFixed(2)}</span>
                              <button
                                onClick={() => setPayingCase(c)}
                                className="px-2 py-1 bg-[#0F766E] hover:bg-[#115E59] text-white text-[9px] font-bold rounded-md transition-all cursor-pointer"
                              >
                                Dar Baixa
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      ) : activeTab === 'andrey_costs' ? (
        /* ANDREY COSTS TAB */
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Custos de Repasse — Dr. Andrey</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Gerencie os descontos de repasse do Dr. Andrey nos casos do mês selecionado.</p>
            </div>
          </div>

          {(() => {
            const andreyCases = cases.filter(c => {
              if (c.status === 'cancelado') return false;
              if (!c.created_at.startsWith(selectedMonth) && !showAllOutstanding) return false;
              if (showAllOutstanding && !c.created_at.startsWith(selectedMonth) && (c.cost_andrey || 0) <= 0) return false;
              return (c.cost_andrey || 0) > 0;
            });

            const totalAndrey = andreyCases.reduce((s, c) => s + (c.cost_andrey || 0), 0);
            const totalDiscounted = andreyCases.filter(c => c.cost_andrey_discounted).reduce((s, c) => s + (c.cost_andrey || 0), 0);
            const totalPending = totalAndrey - totalDiscounted;

            return (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="glass-panel p-4 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Repasse</span>
                    <h3 className="text-lg font-bold text-slate-900">R$ {totalAndrey.toFixed(2)}</h3>
                  </div>
                  <div className="glass-panel p-4 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Já Descontado</span>
                    <h3 className="text-lg font-bold text-emerald-600">R$ {totalDiscounted.toFixed(2)}</h3>
                  </div>
                  <div className="glass-panel p-4 space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Pendente</span>
                    <h3 className="text-lg font-bold text-amber-600">R$ {totalPending.toFixed(2)}</h3>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="p-3">Caso</th>
                        <th className="p-3">Paciente</th>
                        <th className="p-3">Dentista</th>
                        <th className="p-3">Data</th>
                        <th className="p-3 text-right">Valor Andrey</th>
                        <th className="p-3 text-center">Descontado?</th>
                        <th className="p-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {andreyCases.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 text-xs">
                            Nenhum caso com repasse do Dr. Andrey neste período.
                          </td>
                        </tr>
                      ) : (
                        andreyCases.map(c => {
                          const dentist = dentists.find(d => d.id === c.dentist_id);
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/70 transition-all">
                              <td className="p-3 font-mono text-[11px] font-semibold text-slate-800">{c.case_number || c.id}</td>
                              <td className="p-3 font-semibold text-slate-900">{c.patient_name}</td>
                              <td className="p-3 text-slate-600">{dentist?.full_name || '—'}</td>
                              <td className="p-3 text-slate-500">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                              <td className="p-3 text-right font-bold text-slate-900">R$ {(c.cost_andrey || 0).toFixed(2)}</td>
                              <td className="p-3 text-center">
                                {c.cost_andrey_discounted ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold uppercase">Sim</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold uppercase">Pendente</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {!c.cost_andrey_discounted ? (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const updated: Case = { ...c, cost_andrey_discounted: true, updated_at: new Date().toISOString() };
                                        await api.cases.save(updated, 'admin-1');
                                        fetchData();
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-[#0F766E] hover:bg-[#115E59] text-white text-[10px] font-semibold rounded-md transition-all cursor-pointer"
                                  >
                                    Dar Baixa
                                  </button>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const updated: Case = { ...c, cost_andrey_discounted: false, updated_at: new Date().toISOString() };
                                        await api.cases.save(updated, 'admin-1');
                                        fetchData();
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-500 text-[10px] font-semibold rounded-md border border-[#E2E8F0] transition-all cursor-pointer"
                                  >
                                    Desfazer
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
};
