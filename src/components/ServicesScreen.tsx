import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Service, Profile, DentistCustomPrice } from '../types';
import { Search, Plus, Save, Edit, X } from 'lucide-react';

export const ServicesScreen: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [customPrices, setCustomPrices] = useState<DentistCustomPrice[]>([]);
  
  const [activeTab, setActiveTab] = useState<'catalog' | 'custom'>('catalog');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Service Form state
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [billingType, setBillingType] = useState<'per_element' | 'fixed'>('per_element');
  const [defaultValue, setDefaultValue] = useState('0');
  const [estHours, setEstHours] = useState('1');
  const [estMinutes, setEstMinutes] = useState('0');
  const [entersMatheus, setEntersMatheus] = useState(true);
  const [entersPaschoal, setEntersPaschoal] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  
  // Custom pricing state
  const [selectedDentistId, setSelectedDentistId] = useState('');
  const [customPriceInputs, setCustomPriceInputs] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const s = await api.services.list();
      const p = await api.profiles.list();
      const cp = await api.customPrices.list();
      
      setServices(s);
      const dentistList = p.filter(x => x.role === 'dentist');
      setDentists(dentistList);
      setCustomPrices(cp);

      if (dentistList.length > 0) {
        setSelectedDentistId(dentistList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Populate custom price inputs when selected dentist changes
  useEffect(() => {
    if (!selectedDentistId) return;
    const inputs: Record<string, string> = {};
    services.forEach(s => {
      const cp = customPrices.find(p => p.dentist_id === selectedDentistId && p.service_id === s.id);
      inputs[s.id] = cp ? String(cp.custom_value) : '';
    });
    setCustomPriceInputs(inputs);
  }, [selectedDentistId, customPrices, services]);

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const hours = parseFloat(estHours) || 0;
      const minutes = parseFloat(estMinutes) || 0;
      const finalEstTime = hours + minutes / 60;

      const payload: Service = {
        id: editingService?.id || '',
        name,
        description,
        billing_type: billingType,
        default_value: parseFloat(defaultValue) || 0,
        default_estimated_time: finalEstTime,
        enters_matheus_value: entersMatheus,
        enters_paschoal_value: entersPaschoal,
        is_internal_cost: isInternal,
        is_active: editingService ? editingService.is_active : true,
        created_at: editingService?.created_at || new Date().toISOString()
      };

      await api.services.save(payload);
      setShowForm(false);
      setEditingService(null);
      setName('');
      setDescription('');
      setBillingType('per_element');
      setDefaultValue('0');
      setEstHours('1');
      setEstMinutes('0');
      setEntersMatheus(true);
      setEntersPaschoal(false);
      setIsInternal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditServiceClick = (s: Service) => {
    setEditingService(s);
    setName(s.name);
    setDescription(s.description || '');
    setBillingType(s.billing_type);
    setDefaultValue(String(s.default_value));
    
    const t = s.default_estimated_time || 0;
    const h = Math.floor(t);
    const m = Math.round((t - h) * 60);
    setEstHours(String(h));
    setEstMinutes(String(m));

    setEntersMatheus(s.enters_matheus_value);
    setEntersPaschoal(s.enters_paschoal_value);
    setIsInternal(s.is_internal_cost);
    setShowForm(true);
  };

  const handleSaveCustomPrices = async () => {
    if (!selectedDentistId) return;
    setSavingPrices(true);
    try {
      for (const serviceId of Object.keys(customPriceInputs)) {
        const val = customPriceInputs[serviceId];
        const numValue = val.trim() === '' ? -1 : parseFloat(val);
        await api.customPrices.save({
          dentist_id: selectedDentistId,
          service_id: serviceId,
          custom_value: isNaN(numValue) ? -1 : numValue
        });
      }
      // Refresh
      const cp = await api.customPrices.list();
      setCustomPrices(cp);
      alert('Tabela de preços personalizados salva com sucesso!');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPrices(false);
    }
  };

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatEstimatedTime = (time: number) => {
    const h = Math.floor(time);
    const m = Math.round((time - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Serviços e Tabela de Preços</h2>
        <p className="text-slate-500 text-xs mt-1">
          Cadastre procedimentos laboratoriais, defina preços padrão e personalize valores por dentista.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] w-full gap-6 pb-px">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Catálogo Geral
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'custom'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Preços por Dentista
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <div className="space-y-6">
          {/* Catalog Top bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search size={15} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar serviço por nome..."
                className="w-full pl-10 pr-4 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-medium transition-all"
              />
            </div>
            <button
              onClick={() => {
                setEditingService(null);
                setShowForm(true);
              }}
              className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all"
            >
              <Plus size={18} />
              Novo Serviço
            </button>
          </div>

          {/* Form Dialog */}
          {showForm && (
            <div className="fixed inset-0 bg-slate-900/40 z-50 flex justify-center items-center p-4 animate-fade-in">
              <div className="w-full max-w-2xl bg-white border border-[#E2E8F0] rounded-2xl overflow-y-auto p-6 md:p-8 shadow-[0_4px_24px_rgba(15,23,42,0.08)] relative max-h-[90vh]">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingService(null);
                  }}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X size={20} />
                </button>
                <h3 className="text-sm font-bold text-slate-900 mb-1">{editingService ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                <p className="text-[11px] text-slate-500 mb-6">
                  Configure as propriedades do serviço, valores padrão de faturamento e tempos estimados de confecção.
                </p>
                
                <form onSubmit={handleSaveService} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                        Nome do Serviço
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Coroa em Zirconia"
                        className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                        Tipo de Cobrança
                      </label>
                      <select
                        value={billingType}
                        onChange={(e: any) => setBillingType(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] transition-all"
                      >
                        <option value="per_element">Por Elemento (Dente)</option>
                        <option value="fixed">Preço Fixo (Caso completo)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descrição breve dos materiais ou especificações"
                      className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                        Valor Padrão (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={defaultValue}
                        onChange={(e) => setDefaultValue(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                        Tempo Estimado
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="number"
                            min="0"
                            required
                            value={estHours}
                            onChange={(e) => setEstHours(e.target.value)}
                            placeholder="Horas"
                            className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-semibold text-center focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                          />
                          <span className="text-[9px] text-slate-400 text-center block mt-0.5">Horas</span>
                        </div>
                        <div>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            required
                            value={estMinutes}
                            onChange={(e) => setEstMinutes(e.target.value)}
                            placeholder="Minutos"
                            className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-semibold text-center focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] transition-all"
                          />
                          <span className="text-[9px] text-slate-400 text-center block mt-0.5">Minutos</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-[#E2E8F0] space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="entersMatheus"
                        checked={entersMatheus}
                        onChange={(e) => setEntersMatheus(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <label htmlFor="entersMatheus" className="text-[11px] font-medium text-slate-700 cursor-pointer">
                        Entra no faturamento do Dr. Matheus? (Garante comissão/divisão)
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="entersPaschoal"
                        checked={entersPaschoal}
                        onChange={(e) => setEntersPaschoal(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <label htmlFor="entersPaschoal" className="text-[11px] font-medium text-slate-700 cursor-pointer">
                        Entra no faturamento do Dr. Paschoal? (Ex: Parcerias/Terceirização)
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="isInternal"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <label htmlFor="isInternal" className="text-[11px] font-medium text-slate-700 cursor-pointer">
                        É considerado Custo Interno? (Fins tributários ou matéria prima)
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingService(null);
                      }}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-[#E2E8F0] hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-3.5 py-2 rounded-lg text-xs transition-all"
                    >
                      Salvar Serviço
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Grid list of services */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando catálogo de serviços...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map(s => (
                <div key={s.id} className="glass-panel p-4 relative flex flex-col justify-between hover:shadow-sm transition-all">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-sm text-slate-900 leading-snug">{s.name}</h4>
                      <button 
                        onClick={() => handleEditServiceClick(s)}
                        className="p-1.5 rounded-md bg-white border border-[#E2E8F0] text-slate-400 hover:text-slate-600 transition-all"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 min-h-[28px]">{s.description || 'Sem descrição cadastrada'}</p>
                    
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-[11px] border-b border-[#E2E8F0] pb-1">
                        <span className="text-slate-500">Valor padrão:</span>
                        <span className="font-bold text-slate-900">R$ {s.default_value.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] border-b border-[#E2E8F0] pb-1">
                        <span className="text-slate-500">Tipo de cobrança:</span>
                        <span className="font-medium text-slate-700">{s.billing_type === 'per_element' ? 'Por Dente' : 'Fixo por Caso'}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pb-1">
                        <span className="text-slate-500">Tempo estimado:</span>
                        <span className="font-medium text-slate-700">{formatEstimatedTime(s.default_estimated_time)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex flex-wrap gap-1">
                    {s.enters_matheus_value && (
                      <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Matheus</span>
                    )}
                    {s.enters_paschoal_value && (
                      <span className="text-[9px] font-bold bg-sky-500/10 text-sky-500 px-2 py-0.5 rounded-full">Paschoal</span>
                    )}
                    {s.is_internal_cost && (
                      <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">Custo Interno</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB: PREÇOS PERSONALIZADOS */
        <div className="glass-panel p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Personalizar Preços</h3>
              <p className="text-[11px] text-slate-500">
                Selecione um dentista para ver e configurar valores personalizados que divergem da tabela padrão.
              </p>
            </div>
            
            {/* Dentist Select */}
            <div className="w-full sm:w-72">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Dentista Cliente
              </label>
              <select
                value={selectedDentistId}
                onChange={(e) => setSelectedDentistId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-slate-900 text-xs font-medium focus:outline-none focus:border-[#0F766E] transition-all"
              >
                {dentists.map(d => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando tabelas de preços...</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3">Serviço</th>
                      <th className="p-3 text-center">Tipo de Cobrança</th>
                      <th className="p-3 text-right">Preço Padrão</th>
                      <th className="p-3 text-right w-48">Preço Personalizado (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {services.map(s => {
                      const hasCustom = customPrices.some(p => p.dentist_id === selectedDentistId && p.service_id === s.id);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-all">
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 text-xs">{s.name}</div>
                            {hasCustom && (
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5 block">Preço Customizado Ativo</span>
                            )}
                          </td>
                          <td className="p-3 text-center text-slate-500">
                            {s.billing_type === 'per_element' ? 'Por Elemento' : 'Fixo'}
                          </td>
                          <td className="p-3 text-right font-medium text-slate-500">
                            R$ {s.default_value.toFixed(2)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="relative">
                              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs">$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={s.default_value.toFixed(2)}
                                value={customPriceInputs[s.id] || ''}
                                onChange={(e) => {
                                  setCustomPriceInputs({
                                    ...customPriceInputs,
                                    [s.id]: e.target.value
                                  });
                                }}
                                className="w-full pl-7 pr-3 py-1.5 rounded-md bg-white border border-[#E2E8F0] text-right focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] text-xs font-semibold transition-all"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#E2E8F0]">
                <button
                  onClick={handleSaveCustomPrices}
                  disabled={savingPrices}
                  className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-all disabled:opacity-50"
                >
                  <Save size={18} />
                  {savingPrices ? 'Gravando...' : 'Salvar Alterações de Preço'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
