import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, Profile } from '../types';
import { 
  ChevronDown, ChevronUp, Copy, Check, MessageSquare, 
  TrendingUp, ShieldCheck, X 
} from 'lucide-react';

export const FinanceScreen: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);

  
  const [activeTab, setActiveTab] = useState<'billing' | 'reports'>('billing');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [expandedDentistId, setExpandedDentistId] = useState<string | null>(null);

  // Payment modal state
  const [payingCase, setPayingCase] = useState<Case | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(true);

  // Clipboard feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const c = await api.cases.list('admin', 'admin-1');
      const p = await api.profiles.list();
      setCases(c);
      setDentists(p.filter(x => x.role === 'dentist'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCase) return;

    try {
      const amt = isFullPayment ? payingCase.remaining_value : parseFloat(payAmount) || 0;
      const newPaidValue = payingCase.paid_value + amt;
      const newRemainingValue = Math.max(0, payingCase.total_value - newPaidValue);
      
      const newFinStatus = newRemainingValue === 0 
        ? 'pago' 
        : newPaidValue > 0 ? 'pago_parcial' : 'aguardando_pagamento';

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

  // Generate WhatsApp Message
  const getWhatsAppText = (dentist: Profile, pendingCases: Case[], andreyDiscountCredit: number = 0) => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const [year, month] = selectedMonth.split('-');
    const monthLabel = `${monthNames[parseInt(month) - 1]} de ${year}`;
    
    let totalOpen = 0;
    let itemsText = '';
    
    pendingCases.forEach((c) => {
      // Find patient name and services
      const toothSelection = c.teeth_selection.teeth.length > 0 
        ? ` (Dentes: ${c.teeth_selection.teeth.join(',')})`
        : '';
      itemsText += `• Paciente: ${c.patient_name}${toothSelection} — R$ ${c.remaining_value.toFixed(2)}\n`;
      totalOpen += c.remaining_value;
    });

    const pixKey = dentist.pix_key || 'matheus@pix.com'; // Admin default key

    let totalOpenText = '';
    if (andreyDiscountCredit > 0) {
      const finalOpen = Math.max(0, totalOpen - andreyDiscountCredit);
      totalOpenText = `Subtotal em aberto: R$ ${totalOpen.toFixed(2)}\nDesconto de Créditos (Repasse Andrey): -R$ ${andreyDiscountCredit.toFixed(2)}\nTotal com Desconto: *R$ ${finalOpen.toFixed(2)}*`;
    } else {
      totalOpenText = `Total em aberto: *R$ ${totalOpen.toFixed(2)}*`;
    }

    return `Olá, Dr(a). ${dentist.full_name.replace('Dr. ', '').replace('Dra. ', '')}! Segue o fechamento dos casos de ${monthLabel}:\n\n${itemsText}\n${totalOpenText}\n\nPix para pagamento: *${pixKey}*\nFavor enviar o comprovante após a transação. Obrigado!`;
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
      const dentistCases = cases.filter(c => 
        c.dentist_id === d.id && 
        c.created_at.startsWith(selectedMonth) &&
        c.status !== 'cancelado'
      );
      
      const pendingCases = dentistCases.filter(c => c.financial_status !== 'pago' && c.financial_status !== 'isento');
      const totalPending = pendingCases.reduce((sum, c) => sum + c.remaining_value, 0);
      const totalBilled = dentistCases.reduce((sum, c) => sum + c.total_value, 0);

      // Calculate total credit discount for Dr. Andrey
      let andreyDiscountCredit = 0;
      const isAndrey = d.full_name.toLowerCase().includes('andrey');
      if (isAndrey) {
        // Find all cases of the selected month that have cost_andrey_discounted === true
        const discountedCases = cases.filter(c => 
          c.created_at.startsWith(selectedMonth) &&
          c.status !== 'cancelado' &&
          c.cost_andrey_discounted === true
        );
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
      paschoalBillings,
      costAndreyTotal,
      otherCostsTotal,
      internalCosts,
      netProfit
    };
  };

  const summary = getReportSummary();
  const dentistsBalances = getDentistsWithBalances();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Módulo Financeiro</h2>
          <p className="text-muted-foreground text-sm">
            Visualize o fluxo de caixa do laboratório, fechamentos por dentista e gere mensagens de cobrança.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Competência:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-xl bg-secondary border border-white/10 text-xs font-bold text-foreground"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 w-fit gap-1 bg-secondary/30 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'billing'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Fechamentos & Cobrança
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'reports'
              ? 'bg-primary text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Relatório Geral do Mês
        </button>
      </div>

      {activeTab === 'billing' ? (
        /* BILLING AND COBRANCAS TAB */
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Dentistas com Casos Ativos no Mês</h3>
          
          <div className="space-y-3">
            {dentistsBalances.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-white/10 rounded-2xl bg-card">
                Nenhum faturamento registrado para a competência selecionada.
              </div>
            ) : (
              dentistsBalances.map(({ dentist, totalBilled, totalPending, pendingCases, andreyDiscountCredit }) => {
                const isExpanded = expandedDentistId === dentist.id;
                const whatsappText = getWhatsAppText(dentist, pendingCases, andreyDiscountCredit);
                
                return (
                  <div key={dentist.id} className="glass-panel rounded-2xl border border-white/5 overflow-hidden transition-all">
                    
                    {/* Dentist Header Card */}
                    <div 
                      onClick={() => setExpandedDentistId(isExpanded ? null : dentist.id)}
                      className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-secondary/20 transition-all"
                    >
                      <div className="space-y-1">
                        <h4 className="font-bold text-lg text-foreground">{dentist.full_name}</h4>
                        <span className="text-xs text-muted-foreground font-semibold">
                          Total faturado no mês: R$ {totalBilled.toFixed(2)}
                        </span>
                        {andreyDiscountCredit > 0 && (
                          <span className="text-xs text-emerald-500 font-bold block">
                            Créditos de Repasse Andrey Descontados: -R$ {andreyDiscountCredit.toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Total Pendente</span>
                          <span className={`text-base font-black ${totalPending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            R$ {totalPending.toFixed(2)}
                          </span>
                        </div>
                        <span className="p-2 rounded-xl bg-secondary text-muted-foreground">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </div>
                    </div>

                    {/* Dentist Expanded cases / WhatsApp generator */}
                    {isExpanded && (
                      <div className="p-5 bg-secondary/10 border-t border-white/5 space-y-5 animate-fade-in">
                        
                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleCopyText(whatsappText, dentist.id)}
                            className="px-4 py-2.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
                          >
                            {copiedId === dentist.id ? <Check size={14} /> : <Copy size={14} />}
                            {copiedId === dentist.id ? 'Copiado!' : 'Copiar Mensagem WhatsApp'}
                          </button>
                          
                          {dentist.whatsapp && (
                            <a
                              href={`https://wa.me/55${dentist.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
                            >
                              <MessageSquare size={14} />
                              Enviar p/ WhatsApp
                            </a>
                          )}
                        </div>

                        {/* List of expanded dentist's cases */}
                        <div className="overflow-x-auto rounded-xl border border-white/5 bg-card">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-secondary/40 border-b border-white/10">
                              <tr>
                                <th className="p-3 font-bold text-muted-foreground">ID do Caso</th>
                                <th className="p-3 font-bold text-muted-foreground">Paciente</th>
                                <th className="p-3 font-bold text-muted-foreground">Status Clínico</th>
                                <th className="p-3 font-bold text-muted-foreground">Total</th>
                                <th className="p-3 font-bold text-muted-foreground">Pago</th>
                                <th className="p-3 font-bold text-muted-foreground">Aberto</th>
                                <th className="p-3 font-bold text-muted-foreground text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {pendingCases.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="p-4 text-center text-muted-foreground text-xs">
                                    Todos os casos deste mês já estão quitados!
                                  </td>
                                </tr>
                              ) : (
                                pendingCases.map(c => (
                                  <tr key={c.id} className="hover:bg-secondary/20 transition-all">
                                    <td className="p-3 font-bold text-foreground">{c.id}</td>
                                    <td className="p-3 font-semibold">{c.patient_name}</td>
                                    <td className="p-3">
                                      <span className="px-2 py-0.5 rounded-lg bg-secondary border border-white/5 font-semibold text-[9px] uppercase tracking-wide text-foreground">
                                        {c.status}
                                      </span>
                                    </td>
                                    <td className="p-3 font-bold text-foreground">R$ {c.total_value.toFixed(2)}</td>
                                    <td className="p-3 font-bold text-emerald-500">R$ {c.paid_value.toFixed(2)}</td>
                                    <td className="p-3 font-bold text-amber-500">R$ {c.remaining_value.toFixed(2)}</td>
                                    <td className="p-3 text-center">
                                      <button
                                        onClick={() => setPayingCase(c)}
                                        className="px-2.5 py-1 bg-primary hover:bg-primary/95 text-white text-[10px] font-bold rounded-lg transition-all"
                                      >
                                        Baixa Pagamento
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {andreyDiscountCredit > 0 && (
                          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold">
                            Foi aplicado um desconto de R$ {andreyDiscountCredit.toFixed(2)} no saldo total deste mês referente aos créditos de repasse de Andrey assinalados como "Descontado de Dr. Andrey".
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
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl p-6 relative">
                <button
                  onClick={() => setPayingCase(null)}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>

                <h3 className="text-lg font-bold mb-1">Registrar Recebimento</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Conciliação de pagamento para o paciente: <strong>{payingCase.patient_name}</strong>
                </p>

                <form onSubmit={handleRegisterPayment} className="space-y-4">
                  <div className="bg-secondary/30 p-3 rounded-xl border border-white/5 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Total do Caso:</span>
                      <span className="font-bold text-foreground">R$ {payingCase.total_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor já Pago:</span>
                      <span className="font-bold text-emerald-500">R$ {payingCase.paid_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/5">
                      <span className="text-muted-foreground font-bold">Saldo em aberto:</span>
                      <span className="font-bold text-amber-500">R$ {payingCase.remaining_value.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 py-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="fullPay"
                        name="payType"
                        checked={isFullPayment}
                        onChange={() => setIsFullPayment(true)}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <label htmlFor="fullPay" className="text-xs font-semibold cursor-pointer">Quitação Total</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="partialPay"
                        name="payType"
                        checked={!isFullPayment}
                        onChange={() => setIsFullPayment(false)}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <label htmlFor="partialPay" className="text-xs font-semibold cursor-pointer">Pagamento Parcial</label>
                    </div>
                  </div>

                  {!isFullPayment && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Valor Recebido (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground font-semibold text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Comprovante / Link do Recibo (Opcional)
                    </label>
                    <input
                      type="text"
                      value={receiptUrl}
                      onChange={(e) => setReceiptUrl(e.target.value)}
                      placeholder="Link da imagem, PDF ou código de arquivo"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-white/10 text-foreground text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayingCase(null)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-primary hover:bg-primary/95 text-white font-semibold px-4 py-2 rounded-xl text-sm"
                    >
                      Confirmar Pagamento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* GENERAL MONTHLY REPORT TAB */
        <div className="space-y-6 animate-fade-in">
          
          {/* Card Summary indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Faturamento Bruto</span>
              <h3 className="text-2xl font-black text-foreground">R$ {summary.billedTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-muted-foreground">Soma de todos os casos criados</p>
            </div>
            
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Arrecadado (Quitado)</span>
              <h3 className="text-2xl font-black text-emerald-500">R$ {summary.paidTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-muted-foreground">Total de baixas de pagamento</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">A Receber</span>
              <h3 className="text-2xl font-black text-amber-500">R$ {summary.openTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-muted-foreground">Saldo remanescente de devedores</p>
            </div>
          </div>

          {/* Profits & internal divisions detailed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Margins & comissions */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              <h4 className="font-bold text-base text-foreground flex items-center gap-1.5">
                <TrendingUp size={16} className="text-primary" />
                Rendimentos Laboratoriais
              </h4>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/40 border border-white/5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground">Fração Dr. Matheus</span>
                    <span className="text-[10px] text-muted-foreground block">Projetos atribuídos ao Matheus</span>
                  </div>
                  <span className="font-bold text-base text-foreground">R$ {summary.matheusBillings.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/40 border border-white/5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground">Fração Dr. Paschoal</span>
                    <span className="text-[10px] text-muted-foreground block">Projetos em parceria atribuídos</span>
                  </div>
                  <span className="font-bold text-base text-foreground">R$ {summary.paschoalBillings.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Internal Subcontract costs and Net Profit */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              <h4 className="font-bold text-base text-foreground flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-emerald-500" />
                Custos Operacionais & Lucro Líquido
              </h4>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/40 border border-white/5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground">Repasse Andrey</span>
                  </div>
                  <span className="font-semibold text-foreground">R$ {summary.costAndreyTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-secondary/40 border border-white/5 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-foreground">Outros Custos Internos</span>
                    <span className="text-[10px] text-muted-foreground block">Soma de outros custos dinâmicos cadastrados</span>
                  </div>
                  <span className="font-semibold text-foreground">R$ {summary.otherCostsTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-sm font-black">
                  <div className="space-y-0.5">
                    <span>Lucro Líquido Real (Dr. Matheus)</span>
                    <span className="text-[9px] font-bold opacity-80 uppercase block">Fração Matheus menos Custos Internos</span>
                  </div>
                  <span>R$ {summary.netProfit.toFixed(2)}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
