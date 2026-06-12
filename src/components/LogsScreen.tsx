import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { CaseHistory } from '../types';
import { History, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const LogsScreen: React.FC = () => {
  const [logs, setLogs] = useState<CaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await (api.history as any).listAll();
      setLogs(data);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLogDescription = (log: CaseHistory) => {
    if (log.action === 'create') {
      return `Criou o caso ${log.case_id} (Paciente: ${log.new_data?.patient_name || 'N/A'})`;
    }
    if (log.action === 'edit') {
      const changes: string[] = [];
      if (log.previous_data && log.new_data) {
        if (log.previous_data.status !== log.new_data.status) {
          changes.push(`status: "${log.previous_data.status}" ➔ "${log.new_data.status}"`);
        }
        if (log.previous_data.financial_status !== log.new_data.financial_status) {
          changes.push(`financeiro: "${log.previous_data.financial_status}" ➔ "${log.new_data.financial_status}"`);
        }
        if (log.previous_data.paid_value !== log.new_data.paid_value) {
          changes.push(`pago: R$ ${log.previous_data.paid_value} ➔ R$ ${log.new_data.paid_value}`);
        }
      }
      return `Editou o caso ${log.case_id}${changes.length > 0 ? ` (${changes.join(', ')})` : ''}`;
    }
    if (log.action === 'delete') {
      return `Excluiu o caso ${log.case_id}`;
    }
    if (log.action === 'zerar_casos') {
      return `Limpou todos os casos do banco de dados`;
    }
    if (log.action === 'importacao') {
      return `Importou planilha Excel com ${log.new_data?.count || 0} casos`;
    }
    if (log.action === 'create_block') {
      return `Criou bloqueio na agenda: "${log.new_data?.title || 'Sem título'}" (${log.new_data?.type})`;
    }
    if (log.action === 'edit_block') {
      return `Editou bloqueio na agenda: "${log.new_data?.title || 'Sem título'}"`;
    }
    if (log.action === 'delete_block') {
      return `Excluiu bloqueio na agenda: ID ${log.case_id || ''}`;
    }
    return log.new_data?.details || log.action || 'Ação realizada';
  };

  const filteredLogs = logs.filter(log => {
    const term = search.toLowerCase();
    const desc = getLogDescription(log).toLowerCase();
    const userName = (log.user_name || '').toLowerCase();
    const caseId = (log.case_id || '').toLowerCase();
    return desc.includes(term) || userName.includes(term) || caseId.includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <History className="text-[#0F766E]" size={24} />
          Logs de Atividades
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          Rastreabilidade de ações executadas pelos usuários no sistema.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-xl border border-[#E2E8F0] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] pointer-events-none">
            <Search size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Pesquisar logs por usuário, caso ou descrição..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] text-[#0F172A] placeholder:text-[#94A3B8]"
          />
        </div>
        <button
          onClick={fetchLogs}
          className="bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
        >
          Atualizar Logs
        </button>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-12 text-[#64748B] text-sm font-medium">Carregando logs de atividades...</div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-3.5">Data / Hora</th>
                  <th className="p-3.5">Usuário</th>
                  <th className="p-3.5">Descrição da Atividade</th>
                  <th className="p-3.5">ID Caso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-[#64748B] text-xs">
                      Nenhum registro de log encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-all duration-150">
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">
                          {new Date(log.created_at).toLocaleDateString('pt-BR')}
                        </span>{' '}
                        {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                        {log.user_name || 'Desconhecido'}
                      </td>
                      <td className="p-3.5 text-slate-700 font-medium break-words max-w-md">
                        {getLogDescription(log)}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-[#0F766E] whitespace-nowrap font-bold">
                        {log.case_id || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#E2E8F0] gap-4 text-xs font-medium text-slate-500">
              <div>
                Exibindo {Math.min(filteredLogs.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(filteredLogs.length, currentPage * itemsPerPage)} de {filteredLogs.length} logs
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer font-semibold flex items-center gap-1 shadow-sm"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="font-semibold text-slate-700">Página {currentPage} de {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer font-semibold flex items-center gap-1 shadow-sm"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
