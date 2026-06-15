import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Case, CalendarEvent, Profile, CalendarEventType } from '../types';
import { 
  CheckCircle2, Plus, Trash2, ShieldAlert, Info,
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Edit2
} from 'lucide-react';

interface AgendaScreenProps {
  onSelectCase?: (caseId: string) => void;
}

export const AgendaScreen: React.FC<AgendaScreenProps> = ({ onSelectCase }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);
  
  const [activeTab, setActiveTab] = useState<'deliveries' | 'capacity' | 'blocks'>('deliveries');
  const [loading, setLoading] = useState(true);

  // Calendar states
  const [calendarView, setCalendarView] = useState<'monthly' | 'weekly'>('monthly');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [blockTitle, setBlockTitle] = useState('');
  const [blockType, setBlockType] = useState<CalendarEventType>('indisponibilidade');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const c = await api.cases.list('admin', 'admin-1');
      const ev = await api.calendar.list();
      const p = await api.profiles.list();
      setCases(c);
      setEvents(ev);
      setDentists(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calendar utilities
  const getDaysInMonthGrid = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // First day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday, 6 is Saturday
    
    // Start date of the grid (go back to Sunday)
    const gridStart = new Date(firstDayOfMonth);
    gridStart.setDate(gridStart.getDate() - startDayOfWeek);
    
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(gridStart));
      gridStart.setDate(gridStart.getDate() + 1);
    }
    return days;
  };

  const getDaysInWeekGrid = (date: Date) => {
    const currentDay = date.getDay(); // 0-6
    const gridStart = new Date(date);
    gridStart.setDate(gridStart.getDate() - currentDay); // go back to Sunday
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(gridStart));
      gridStart.setDate(gridStart.getDate() + 1);
    }
    return days;
  };

  const getCasesForDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return cases.filter(c => {
      const deliveryDate = c.final_delivery_date || c.requested_delivery_date;
      return deliveryDate === dateStr;
    });
  };

  const getEventsForDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return events.filter(ev => {
      return ev.start_date <= dateStr && ev.end_date >= dateStr;
    });
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (calendarView === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else {
      nextDate.setDate(nextDate.getDate() - 7);
    }
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (calendarView === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
      nextDate.setDate(nextDate.getDate() + 7);
    }
    setCurrentDate(nextDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle || !startDate || !endDate) return;

    try {
      const payload: CalendarEvent = {
        id: editingEventId || '',
        title: blockTitle,
        type: blockType,
        start_date: startDate,
        end_date: endDate,
        notes: blockNotes,
        created_at: new Date().toISOString()
      };

      if (blockType === 'consulta') {
        payload.start_time = startTime || undefined;
        payload.end_time = endTime || undefined;
      }

      await api.calendar.save(payload);
      setBlockTitle('');
      setStartDate('');
      setEndDate('');
      setBlockNotes('');
      setStartTime('');
      setEndTime('');
      setEditingEventId(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditBlock = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setBlockTitle(ev.title);
    setBlockType(ev.type);
    setStartDate(ev.start_date);
    setEndDate(ev.end_date);
    setBlockNotes(ev.notes || '');
    setStartTime(ev.start_time || '');
    setEndTime(ev.end_time || '');
    setActiveTab('blocks');
  };

  const handleCancelEdit = () => {
    setEditingEventId(null);
    setBlockTitle('');
    setStartDate('');
    setEndDate('');
    setBlockNotes('');
    setStartTime('');
    setEndTime('');
  };

  const handleDeleteBlock = async (id: string) => {
    if (!window.confirm('Excluir este bloqueio de agenda?')) return;
    try {
      await api.calendar.delete(id);
      if (editingEventId === id) {
        handleCancelEdit();
      }
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Capacity calculations
  const activeCases = cases.filter(c => !['finalizado', 'entregue', 'cancelado'].includes(c.status));
  const committedHours = activeCases.reduce((sum, c) => sum + c.estimated_hours, 0);

  // Available hours: 44 hours per week default.
  // Calculate if there are blocking events in the current week/month.
  // E.g., subtract 8 hours for each weekday of 'viagem' or 'feriado'
  const getCapacityAnalysis = () => {
    let baseAvailableHours = 44; // default weekly capacity
    let blockedHours = 0;

    // Check events in the next 7 days
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    const today = new Date();

    events.forEach(ev => {
      // Exclude neuroreab and consulta from subtracting capacity hours
      if (ev.type === 'neuroreab' || ev.type === 'consulta') return;

      const start = new Date(ev.start_date);
      const end = new Date(ev.end_date);
      
      // If event overlaps with the next 7 days
      if (start <= next7Days && end >= today) {
        // Simple mock: count days and multiply by 8 hours
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        blockedHours += diffDays * 8;
      }
    });

    const netAvailableHours = Math.max(0, baseAvailableHours - blockedHours);
    const overloadPercent = netAvailableHours > 0 ? (committedHours / netAvailableHours) * 100 : 100;
    const isOverloaded = committedHours > netAvailableHours;

    return {
      netAvailableHours,
      blockedHours,
      overloadPercent,
      isOverloaded
    };
  };

  const cap = getCapacityAnalysis();

  const getEventBadgeColor = (type: CalendarEventType) => {
    const styles: Record<CalendarEventType, string> = {
      feriado: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      viagem: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      bloqueio: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      indisponibilidade: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      neuroreab: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
      consulta: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
    };
    return styles[type];
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando cronogramas e capacidade...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Agenda & Capacidade</h2>
        <p className="text-slate-500 text-xs mt-1">
          Planeje prazos de entrega, visualize a carga de trabalho laboratorial e configure bloqueios de expediente.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] w-full gap-6 pb-px">
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'deliveries'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Cronograma de Entregas
        </button>
        <button
          onClick={() => setActiveTab('capacity')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'capacity'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Capacidade Produtiva
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'blocks'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Bloqueios e Feriados
        </button>
      </div>

      {activeTab === 'deliveries' ? (
        /* DELIVERIES TAB - GOOGLE-STYLE CALENDAR */
        <div className="glass-panel p-5 space-y-5 animate-fade-in">
          {/* Calendar Navigation and View Toggles */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <CalendarIcon size={16} className="text-[#0F766E]" />
                {calendarView === 'monthly' 
                  ? `${monthNames[currentDate.getMonth()]} de ${currentDate.getFullYear()}`
                  : `Semana de ${new Date(getDaysInWeekGrid(currentDate)[0]).toLocaleDateString('pt-BR')} a ${new Date(getDaysInWeekGrid(currentDate)[6]).toLocaleDateString('pt-BR')}`
                }
              </h3>
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E2E8F0]">
                <button
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-slate-50 rounded-md transition-all text-slate-500"
                  title="Anterior"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2 py-1 text-[10px] font-bold hover:bg-slate-50 rounded-md transition-all text-slate-700"
                >
                  Hoje
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 hover:bg-slate-50 rounded-md transition-all text-slate-500"
                  title="Próximo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-[#E2E8F0]">
              <button
                onClick={() => setCalendarView('monthly')}
                className={`px-3 py-1.5 text-[10px] font-semibold rounded-md transition-all ${
                  calendarView === 'monthly'
                    ? 'bg-white text-slate-900 border border-[#E2E8F0] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setCalendarView('weekly')}
                className={`px-3 py-1.5 text-[10px] font-semibold rounded-md transition-all ${
                  calendarView === 'weekly'
                    ? 'bg-white text-slate-900 border border-[#E2E8F0] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Semanal
              </button>
            </div>
          </div>

          {calendarView === 'monthly' ? (
            /* MONTHLY VIEW GRID */
            <div className="grid grid-cols-7 gap-px bg-[#E2E8F0] rounded-xl overflow-hidden border border-[#E2E8F0]">
              {/* Day names */}
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="bg-slate-50 py-2 text-center text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                  {d}
                </div>
              ))}

              {getDaysInMonthGrid(currentDate).map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === new Date().toDateString();
                const dayCases = getCasesForDate(day);
                const dayEvents = getEventsForDate(day);

                return (
                  <div 
                    key={idx} 
                    className={`min-h-[100px] bg-white p-2 flex flex-col justify-between hover:bg-slate-50/60 transition-all ${
                      isCurrentMonth ? '' : 'opacity-40'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-bold ${
                        isToday 
                          ? 'bg-[#0F766E] text-white w-5 h-5 rounded-full flex items-center justify-center shadow-sm' 
                          : 'text-slate-400'
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[80px] pr-0.5 custom-scrollbar">
                      {/* Events/Blockages */}
                      {dayEvents.map(ev => {
                        const emojiMap: Record<string, string> = {
                          feriado: '🎈',
                          viagem: '✈️',
                          bloqueio: '🚫',
                          indisponibilidade: '📴',
                          neuroreab: '🧠',
                          consulta: '🩺'
                        };
                        const emoji = emojiMap[ev.type] || '🚫';
                        const timeStr = ev.type === 'consulta' && ev.start_time ? ` (${ev.start_time})` : '';
                        return (
                          <div 
                            key={ev.id}
                            onClick={() => handleStartEditBlock(ev)}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-50 text-rose-600 border border-rose-100 truncate cursor-pointer hover:bg-rose-100 transition-all"
                            title={`${ev.title}: ${ev.notes || ''}`}
                          >
                            {emoji} {ev.title}{timeStr}
                          </div>
                        );
                      })}

                      {/* Cases */}
                      {dayCases.map(c => {
                        const dentist = dentists.find(d => d.id === c.dentist_id);
                        return (
                          <div 
                            key={c.id}
                            onClick={() => onSelectCase && onSelectCase(c.id)}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-teal-50 text-[#0F766E] border border-teal-100 hover:bg-teal-100 transition-all truncate cursor-pointer"
                            title={`Caso ${c.id} - Paciente: ${c.patient_name} (${dentist?.full_name || ''})`}
                          >
                            📦 {c.patient_name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* WEEKLY VIEW GRID */
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {getDaysInWeekGrid(currentDate).map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const dayCases = getCasesForDate(day);
                const dayEvents = getEventsForDate(day);
                const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

                return (
                  <div 
                    key={idx} 
                    className={`glass-panel p-4 flex flex-col justify-between min-h-[200px] transition-all ${
                      isToday 
                        ? 'border-[#0F766E] border-2 bg-teal-50/30' 
                        : ''
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          {weekdays[day.getDay()]}
                        </span>
                        <span className={`text-base font-extrabold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {day.getDate()}
                        </span>
                      </div>

                      <div className="space-y-2 overflow-y-auto max-h-[140px] pr-0.5">
                        {dayEvents.length === 0 && dayCases.length === 0 && (
                          <div className="text-[10px] text-muted-foreground italic text-center py-6">
                            Sem prazos
                          </div>
                        )}

                        {/* Events */}
                        {dayEvents.map(ev => {
                          const emojiMap: Record<string, string> = {
                            feriado: '🎈',
                            viagem: '✈️',
                            bloqueio: '🚫',
                            indisponibilidade: '📴',
                            neuroreab: '🧠',
                            consulta: '🩺'
                          };
                          const emoji = emojiMap[ev.type] || '🚫';
                          const timeStr = ev.type === 'consulta' && ev.start_time ? ` (${ev.start_time})` : '';
                          return (
                            <div 
                              key={ev.id}
                              onClick={() => handleStartEditBlock(ev)}
                              className="p-1.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-100 space-y-0.5 cursor-pointer hover:bg-rose-100 transition-all"
                              title={`${ev.title}: ${ev.notes || ''}`}
                            >
                              <div className="flex items-center gap-1 text-[10px]">
                                <span>{emoji}</span>
                                <span className="truncate">{ev.title}{timeStr}</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Cases */}
                        {dayCases.map(c => {
                          const dentist = dentists.find(d => d.id === c.dentist_id);
                          return (
                            <div 
                              key={c.id}
                              onClick={() => onSelectCase && onSelectCase(c.id)}
                              className="p-2 rounded-md text-[10px] font-semibold bg-teal-50 text-[#0F766E] border border-teal-100 hover:bg-teal-100 transition-all cursor-pointer space-y-1"
                            >
                              <div className="flex justify-between items-center">
                                <span className="truncate">📦 {c.patient_name}</span>
                              </div>
                              <div className="text-[9px] text-muted-foreground">
                                Dr. {dentist?.full_name || 'Desconhecido'}
                              </div>
                              <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-[8px] font-bold uppercase text-[#0F766E]">
                                {c.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'capacity' ? (
        /* CAPACITY PRODUCTIVITY TAB */
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Status Indicator */}
            <div className={`glass-panel p-5 flex flex-col justify-between ${
              cap.isOverloaded 
                ? '' 
                : ''
            }`}>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-widest block text-slate-400">Status Produtivo</span>
                <h3 className={`text-lg font-bold ${cap.isOverloaded ? 'text-rose-600' : 'text-emerald-600'}`}>{cap.isOverloaded ? 'Alerta: Sobrecarga!' : 'Capacidade Adequada'}</h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  {cap.isOverloaded 
                    ? 'O volume estimado de horas excede o limite disponível para a semana.' 
                    : 'A fila de confecção está equilibrada com o horário laboratorial.'
                  }
                </p>
              </div>
              <span className={`p-2.5 border border-[#E2E8F0] rounded-lg mt-3 w-fit ${cap.isOverloaded ? 'text-rose-500' : 'text-emerald-500'}`}>
                {cap.isOverloaded ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
              </span>
            </div>

            {/* Total Committed hours */}
            <div className="glass-panel p-5 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Horas Comprometidas</span>
                <h3 className="text-2xl font-bold text-slate-900">{committedHours.toFixed(2)}h</h3>
                <p className="text-[10px] text-slate-500">Soma estimada de todos os dentes/casos ativos.</p>
              </div>
              
              {/* Progress bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>Volume da Fila</span>
                  <span>{cap.overloadPercent.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-[#E2E8F0]">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${cap.isOverloaded ? 'bg-rose-500' : 'bg-[#0F766E]'}`} 
                    style={{ width: `${Math.min(100, cap.overloadPercent)}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Net Available hours */}
            <div className="glass-panel p-5 flex flex-col justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Horas Disponíveis (Semana)</span>
                <h3 className="text-2xl font-bold text-[#0F766E]">{cap.netAvailableHours.toFixed(2)}h</h3>
                <p className="text-[10px] text-slate-500">Feriados ou viagens reduzem esse tempo.</p>
              </div>
              
              <div className="bg-slate-50 p-2.5 rounded-lg border border-[#E2E8F0] flex items-center gap-2 text-[10px] text-slate-500 mt-3">
                <Info size={12} className="text-[#0F766E] shrink-0" />
                <span>Bloqueios ativos nesta semana: {cap.blockedHours.toFixed(2)}h</span>
              </div>
            </div>

          </div>

          {/* Productivity recommendations */}
          <div className="glass-panel p-5 space-y-3">
            <h4 className="font-semibold text-sm text-slate-900">Diretrizes de Cronograma Laboratorial</h4>
            <ul className="text-[11px] text-slate-500 space-y-2 list-disc list-inside">
              <li>Horário Padrão de Expediente: Segunda a Sexta comercial (8h às 12h, 13h30 às 18h) + Sábado de manhã (8h às 12h).</li>
              <li>A capacidade máxima semanal líquida padrão é de <strong>44 horas de bancada</strong>.</li>
              <li>Caso novos trabalhos entrem na zona de sobrecarga (faixa vermelha), defina os prazos finais de entrega com folga de 3 a 5 dias adicionais.</li>
            </ul>
          </div>
        </div>
      ) : (
        /* CALENDAR EVENTS AND BLOCKAGES TAB */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          
          {/* List of active blocks */}
          <div className="glass-panel p-5 md:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm text-slate-900">Bloqueios & Feriados Ativos</h3>
              <span className="text-[10px] text-slate-400 font-medium">({events.length} registrados)</span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {events.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs border border-dashed border-[#E2E8F0] rounded-xl">
                  Nenhum bloqueio de agenda configurado.
                </div>
              ) : (
                events.map(ev => {
                  const emojiMap: Record<string, string> = {
                    feriado: '🎈',
                    viagem: '✈️',
                    bloqueio: '🚫',
                    indisponibilidade: '📴',
                    neuroreab: '🧠',
                    consulta: '🩺'
                  };
                  const emoji = emojiMap[ev.type] || '🚫';
                  const timeStr = ev.type === 'consulta' && ev.start_time ? ` (${ev.start_time}${ev.end_time ? ` - ${ev.end_time}` : ''})` : '';
                  return (
                    <div key={ev.id} className="p-3 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-between hover:bg-slate-50 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900">{emoji} {ev.title}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${getEventBadgeColor(ev.type)}`}>
                            {ev.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Período: {new Date(ev.start_date).toLocaleDateString('pt-BR')} até {new Date(ev.end_date).toLocaleDateString('pt-BR')}{timeStr}
                        </p>
                        {ev.notes && <p className="text-[10px] font-medium text-muted-foreground">Nota: {ev.notes}</p>}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStartEditBlock(ev)}
                          className="p-1.5 rounded-lg bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50 transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteBlock(ev.id)}
                          className="p-1.5 rounded-lg bg-white text-rose-500 border border-[#E2E8F0] hover:bg-rose-50 hover:border-rose-200 transition-all"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Form to add/edit block */}
          <div className="glass-panel p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-900">
                {editingEventId ? 'Editar Bloqueio' : 'Bloquear Agenda'}
              </h3>
              
              <form onSubmit={handleCreateBlock} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Título / Motivo
                  </label>
                  <input
                    type="text"
                    required
                    value={blockTitle}
                    onChange={(e) => setBlockTitle(e.target.value)}
                    placeholder="Ex: Feriado Tiradentes"
                    className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-medium text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Tipo do Bloqueio
                  </label>
                  <select
                    value={blockType}
                    onChange={(e: any) => {
                      setBlockType(e.target.value);
                      if (e.target.value !== 'consulta') {
                        setStartTime('');
                        setEndTime('');
                      }
                    }}
                    className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                  >
                    <option value="indisponibilidade">Indisponibilidade</option>
                    <option value="feriado">Feriado</option>
                    <option value="viagem">Viagem</option>
                    <option value="bloqueio">Bloqueio Geral</option>
                    <option value="neuroreab">Neuroreabilitação</option>
                    <option value="consulta">Consulta Médica</option>
                  </select>
                </div>

                {blockType === 'consulta' && (
                  <div className="grid grid-cols-2 gap-3 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Hora Início
                      </label>
                      <input
                        type="time"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Hora Fim
                      </label>
                      <input
                        type="time"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Data Início
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Data Fim
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    value={blockNotes}
                    onChange={(e) => setBlockNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="submit"
                    className="w-full bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold py-2.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {editingEventId ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                    {editingEventId ? 'Salvar Alterações' : 'Adicionar Bloqueio'}
                  </button>

                  {editingEventId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 rounded-lg text-xs transition-all border border-[#E2E8F0] cursor-pointer"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
