import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case } from '../types';
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { Calendar, Filter, BarChart2 } from 'lucide-react';

export const ChartsScreen: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  
  // By default, last 30 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await api.cases.list('admin', 'admin-1');
        setCases(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getFilteredData = () => {
    const filteredCases = cases.filter(c => {
      const caseDate = c.created_at.split('T')[0];
      return caseDate >= startDate && caseDate <= endDate && c.status !== 'cancelado';
    });

    const aggregated: Record<string, { name: string, casos: number, elementos: number }> = {};

    filteredCases.forEach(c => {
      const date = new Date(c.created_at);
      let key = '';
      let name = '';

      if (groupBy === 'day') {
        key = c.created_at.split('T')[0];
        // Ensure local time avoids timezone shift 
        name = new Date(key + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      } else if (groupBy === 'week') {
        // Week calculation
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        key = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
        name = `Semana ${weekNo}`;
      } else {
        key = c.created_at.slice(0, 7); // YYYY-MM
        const m = parseInt(key.split('-')[1]);
        const y = key.split('-')[0];
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        name = `${monthNames[m - 1]}/${y.slice(2)}`;
      }

      if (!aggregated[key]) {
        aggregated[key] = { name, casos: 0, elementos: 0 };
      }

      aggregated[key].casos += 1;
      aggregated[key].elementos += (c.teeth_selection?.teeth?.length || 0);
    });

    return Object.keys(aggregated).sort().map(key => aggregated[key]);
  };

  const chartData = getFilteredData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Gráficos & Análises</h2>
          <p className="text-slate-500 text-xs mt-1">
            Análise de volume de casos e elementos produzidos.
          </p>
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="flex flex-col md:flex-row gap-4 items-end mb-6 border-b border-slate-200 pb-5">
          
          <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Data Inicial
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-9 pr-3.5 py-2 w-full sm:w-auto rounded-lg bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Data Final
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-9 pr-3.5 py-2 w-full sm:w-auto rounded-lg bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Agrupar por
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <select
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value as any)}
                  className="pl-9 pr-8 py-2 w-full sm:w-auto rounded-lg bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all appearance-none"
                >
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                  <option value="month">Mês</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - 7);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
                setGroupBy('day');
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all flex-1 sm:flex-none cursor-pointer"
            >
              7 Dias
            </button>
            <button 
              onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - 30);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
                setGroupBy('day');
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all flex-1 sm:flex-none cursor-pointer"
            >
              30 Dias
            </button>
            <button 
              onClick={() => {
                const d = new Date(); d.setMonth(d.getMonth() - 12);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
                setGroupBy('month');
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all flex-1 sm:flex-none cursor-pointer"
            >
              12 Meses
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-[400px] flex items-center justify-center text-slate-400 text-sm font-medium">
            Carregando dados...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 text-sm font-medium gap-2">
            <BarChart2 size={32} className="opacity-50" />
            Nenhum dado encontrado para o período selecionado.
          </div>
        ) : (
          <div className="space-y-8">
            <div className="h-[400px] w-full">
              <h3 className="text-sm font-bold text-slate-900 mb-4 text-center">Volume de Casos vs Elementos</h3>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10, fill: '#64748B' }} 
                    tickMargin={10} 
                    axisLine={{ stroke: '#CBD5E1' }} 
                    tickLine={false} 
                  />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 10, fill: '#64748B' }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 10, fill: '#64748B' }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    cursor={{ fill: '#F1F5F9' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                  
                  <Bar 
                    yAxisId="left" 
                    dataKey="elementos" 
                    name="Elementos" 
                    fill="#0F766E" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={50}
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="casos" 
                    name="Casos" 
                    stroke="#F59E0B" 
                    strokeWidth={3}
                    activeDot={{ r: 6 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
