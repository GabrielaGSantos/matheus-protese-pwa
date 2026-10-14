import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Calendar, Activity, Check, X, Layers, User, Hash, ExternalLink, Info } from 'lucide-react';
import type { Service, CustomStatus } from '../types';
import { DEFAULT_CASE_STATUSES } from '../types';
import {
  type DuplicateMatch,
  formatCaseDate,
  formatCaseServices,
  formatTeethSelection
} from '../utils/similarity';

interface DuplicatePatientModalProps {
  isOpen: boolean;
  inputPatientName: string;
  dentistName?: string;
  matches: DuplicateMatch[];
  services: Service[];
  caseStatuses?: CustomStatus[];
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const DuplicatePatientModal: React.FC<DuplicatePatientModalProps> = ({
  isOpen,
  inputPatientName,
  dentistName,
  matches,
  services,
  caseStatuses = DEFAULT_CASE_STATUSES,
  onConfirm,
  onCancel,
  isSubmitting = false
}) => {
  if (!isOpen || matches.length === 0) return null;

  const getStatusBadge = (statusId: string) => {
    const found = caseStatuses.find(s => s.id === statusId);
    const label = found?.label || statusId;
    const colorClass = found?.colorClass || 'bg-slate-100 text-slate-700 border-slate-200';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClass}`}>
        {label}
      </span>
    );
  };

  const hasIdentical = matches.some(m => m.matchType === 'identical');
  const count = matches.length;

  const handleOpenCaseInNewTab = (caseId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?caseId=${encodeURIComponent(caseId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-white border border-amber-200/80 rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.2)] overflow-hidden my-auto flex flex-col max-h-[92vh] animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-b border-amber-200/60 px-5 py-4 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
            <AlertTriangle size={22} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="duplicate-modal-title" className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>{hasIdentical ? 'Paciente Já Cadastrado!' : 'Possível Paciente Duplicado'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                hasIdentical ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {hasIdentical ? 'Nome Idêntico' : 'Nome Semelhante'}
              </span>
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Já existe registro de caso para este dentista com nome idêntico ou muito semelhante ao digitado.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/80 transition-all cursor-pointer shrink-0"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Highlight of current input */}
        <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200/60 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Novo paciente digitado:</span>
            <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
              {inputPatientName}
            </span>
          </div>
          {dentistName && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="text-slate-400">Dentista:</span>
              <span className="font-semibold text-slate-800">{dentistName}</span>
            </div>
          )}
        </div>

        {/* Content Body: List of matching cases */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 divide-y divide-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} />
              <span>{count > 1 ? `Múltiplos Casos Encontrados (${count})` : `Caso Encontrado no Sistema (${count})`}</span>
            </div>
            {count > 1 && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-600" />
                Atenção: Há {count} casos semelhantes cadastrados
              </span>
            )}
          </div>

          {count > 1 && (
            <div className="bg-amber-500/10 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Aviso de duplicidade múltipla: </span>
                Foram identificados <strong>{count} casos</strong> deste mesmo dentista que coincidem com o nome digitado. Abra os casos abaixo em uma nova aba para analisar o histórico antes de prosseguir.
              </div>
            </div>
          )}

          {matches.map((match, idx) => {
            const { caseItem, matchType, reason } = match;
            const servicesText = formatCaseServices(caseItem.selected_services, services);
            const teethText = formatTeethSelection(caseItem.teeth_selection);
            const isExact = matchType === 'identical';

            return (
              <div 
                key={caseItem.id || idx} 
                className={`pt-3.5 first:pt-0 rounded-xl border p-3.5 transition-all ${
                  isExact 
                    ? 'border-rose-200/80 bg-rose-50/30 hover:bg-rose-50/50' 
                    : 'border-amber-200/70 bg-amber-50/20 hover:bg-amber-50/40'
                }`}
              >
                {/* Header of the matching card */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isExact ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <User size={14} className="text-slate-500" />
                      {caseItem.patient_name}
                    </span>
                    {caseItem.case_number && (
                      <span className="text-[10px] font-mono text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-0.5">
                        <Hash size={10} />
                        {caseItem.case_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isExact ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {reason}
                    </span>
                  </div>
                </div>

                {/* Details Grid: Data, Status, Nome, Serviço e Elementos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* Data */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <Calendar size={11} className="text-slate-500" />
                      <span>Data de Entrada / Criação</span>
                    </div>
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>{formatCaseDate(caseItem.created_at)}</span>
                      {caseItem.requested_delivery_date && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          (Previsão: {formatCaseDate(caseItem.requested_delivery_date)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <Activity size={11} className="text-slate-500" />
                      <span>Status do Caso</span>
                    </div>
                    <div>
                      {getStatusBadge(caseItem.status)}
                    </div>
                  </div>

                  {/* Serviço(s) */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <Layers size={11} className="text-slate-500" />
                      <span>Serviço(s) Solicitado(s)</span>
                    </div>
                    <div className="font-semibold text-slate-800 text-[11px] leading-snug">
                      {servicesText}
                    </div>
                  </div>

                  {/* Elementos / Dentes */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <span className="text-slate-500 font-mono text-[10px]">🦷</span>
                      <span>Elementos do Odontograma</span>
                    </div>
                    <div className="font-semibold text-slate-800 text-[11px] leading-snug">
                      {teethText}
                    </div>
                  </div>
                </div>

                {/* Notes if present */}
                {caseItem.dentist_notes && (
                  <div className="mt-2.5 bg-white/70 p-2 rounded-lg border border-slate-200/60 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-700">Observações: </span>
                    <span className="line-clamp-2">{caseItem.dentist_notes}</span>
                  </div>
                )}

                {/* Action: Open in new tab to analyze */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-slate-500">
                    Deseja inspecionar este caso anterior?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenCaseInNewTab(caseItem.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all cursor-pointer shadow-2xs"
                    title="Abre este caso em uma nova aba do navegador para análise"
                  >
                    <span>Ir para caso em nova aba</span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with confirmation buttons */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600 font-medium text-center sm:text-left">
            Tem certeza de que deseja criar este novo caso mesmo assim?
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X size={14} />
              <span>Não, Cancelar / Revisar</span>
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition-all shadow-sm shadow-amber-600/30 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={14} />
              <span>{isSubmitting ? 'Salvando...' : 'Sim, Criar Mesmo Assim'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
