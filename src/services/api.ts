import { createClient } from '@supabase/supabase-js';
import type { 
  Profile, 
  Service, 
  DentistCustomPrice, 
  Case, 
  CalendarEvent, 
  CaseHistory,
  UserRole,
  FileAttachment,
  InternalNote
} from '../types';
import importedCases from './imported_cases.json';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true' || !supabaseUrl || !supabaseAnonKey;

// Initialize Supabase Client safely
export const supabase = (!useMockData && supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// =========================================================================
// MOCK DATABASE & STORAGE (SEEDED WITH DENTISTS AND SERVICES)
// =========================================================================

const MOCK_STORAGE_KEYS = {
  PROFILES: 'matheus_protese_profiles',
  SERVICES: 'matheus_protese_services',
  CUSTOM_PRICES: 'matheus_protese_custom_prices',
  CASES: 'matheus_protese_cases',
  CASE_SERVICES: 'matheus_protese_case_services',
  CALENDAR_EVENTS: 'matheus_protese_calendar_events',
  HISTORY: 'matheus_protese_history',
  ATTACHMENTS: 'matheus_protese_attachments',
  CURRENT_USER: 'matheus_protese_current_user',
  NOTES: 'matheus_protese_notes',
  GDRIVE_SETTINGS: 'gdrive_shared_settings'
};

const defaultServices: Service[] = [
  { id: 's1', name: 'Enceramento Digital', billing_type: 'per_element', default_value: 35.00, default_estimated_time: 0.33, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's2', name: 'Impressão', billing_type: 'fixed', default_value: 50.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's3', name: 'Fresar', billing_type: 'per_element', default_value: 120.00, default_estimated_time: 0.33, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's4', name: 'Coroa em Zirconia', billing_type: 'per_element', default_value: 450.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's5', name: 'Coroa de Dissilicato', billing_type: 'per_element', default_value: 400.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's6', name: 'Protocolo zirconia', billing_type: 'fixed', default_value: 3500.00, default_estimated_time: 2.0, enters_matheus_value: true, enters_paschoal_value: true, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's7', name: 'Modelo Total', billing_type: 'fixed', default_value: 80.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's8', name: 'Placa', billing_type: 'fixed', default_value: 150.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's9', name: 'Pigmentação', billing_type: 'per_element', default_value: 60.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's10', name: 'Gengiva', billing_type: 'fixed', default_value: 300.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's11', name: 'Finalização', billing_type: 'fixed', default_value: 250.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() },
  { id: 's12', name: 'Finalização P', 'billing_type': 'fixed', default_value: 150.00, default_estimated_time: 0, enters_matheus_value: true, enters_paschoal_value: false, is_internal_cost: false, is_active: true, created_at: new Date().toISOString() }
];

const mockDentistsNames = [
  'Dr. Allan', 'Dra. Monique', 'Dra. Monique/Iasmim', 'Dr. Lucas', 'Dr. Andrey', 
  'Dr. Tiago', 'Dra. Fabiane', 'Matheus Maldonado', 'Dr. Marcus Paulo', 
  'Dr. Pedro Echner', 'Dr. Anderson', 'Dra. Kerollen', 'Dr. Gustavo B', 
  'Dr. Iuri Silveira', 'Dr. Ricardo', 'Dr. Mateus Tonetto', 'Dr. Jose Diniz', 
  'Marcio Kazikawa', 'Dr. Fabricio Ferreira', 'Gustavo Damiani', 'Dra. Isabela', 
  'Dra. Laura Vieira', 'Dr. Gustavo D', 'Dra. Francielly'
];

function seedMockDatabase() {
  if (!localStorage.getItem(MOCK_STORAGE_KEYS.PROFILES)) {
    const profiles: Profile[] = [
      {
        id: 'admin-1',
        role: 'admin',
        full_name: 'Dr. Matheus Iorczeski',
        whatsapp: '47999999999',
        pix_key: 'matheus@pix.com',
        created_at: new Date().toISOString()
      },
      {
        id: 'sec-1',
        role: 'secretary',
        full_name: 'Secretária Iorc Lab',
        whatsapp: '47999999998',
        created_at: new Date().toISOString()
      }
    ];

    mockDentistsNames.forEach((name, i) => {
      profiles.push({
        id: `dentist-${i + 1}`,
        role: 'dentist',
        full_name: name,
        whatsapp: `4798888777${i % 10}`,
        created_at: new Date().toISOString()
      });
    });

    localStorage.setItem(MOCK_STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  }

  if (!localStorage.getItem(MOCK_STORAGE_KEYS.SERVICES)) {
    localStorage.setItem(MOCK_STORAGE_KEYS.SERVICES, JSON.stringify(defaultServices));
  }

  if (!localStorage.getItem(MOCK_STORAGE_KEYS.CALENDAR_EVENTS)) {
    const events: CalendarEvent[] = [
      {
        id: 'event-1',
        title: 'Feriado Nacional',
        start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0],
        end_date: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0],
        type: 'feriado',
        notes: 'Sem expediente',
        created_at: new Date().toISOString()
      },
      {
        id: 'event-2',
        title: 'Congresso Odonto',
        start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 24).toISOString().split('T')[0],
        end_date: new Date(new Date().getFullYear(), new Date().getMonth(), 26).toISOString().split('T')[0],
        type: 'viagem',
        notes: 'Dr. Matheus viajando',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(MOCK_STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(events));
  }

  if (!localStorage.getItem(MOCK_STORAGE_KEYS.CASES)) {
    const today = new Date();
    const defaultCases: Case[] = [
      {
        id: 'CASE-202606-0001',
        dentist_id: 'dentist-1', // Dr. Allan
        patient_name: 'Ana Silva',
        created_at: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        requested_delivery_date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        final_delivery_date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'em_execucao',
        financial_status: 'aguardando_pagamento',
        teeth_selection: { teeth: [11, 12, 21, 22], type: 'ponte' },
        dentist_notes: 'Fazer com capricho na gengiva.',
        internal_notes: 'Allan pediu urgência.',
        has_photo: true,
        has_file: false,
        google_drive_folder_id: 'folder-1',
        google_drive_folder_url: 'https://drive.google.com',
        estimated_hours: 8,
        value_matheus: 1200.00,
        value_planning: 300.00,
        value_paschoal: 0.00,
        cost_allan_matheus: 100.00,
        cost_allan_solo: 0.00,
        cost_andrey: 50.00,
        other_internal_costs: [],
        total_value: 1500.00,
        paid_value: 0.00,
        remaining_value: 1500.00,
        updated_at: new Date().toISOString()
      },
      {
        id: 'CASE-202606-0002',
        dentist_id: 'dentist-2', // Dra. Monique
        patient_name: 'Carlos Santos',
        created_at: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        requested_delivery_date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        final_delivery_date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'finalizado',
        financial_status: 'pago',
        teeth_selection: { teeth: [36], type: 'individual' },
        dentist_notes: 'Coroa metal free.',
        has_photo: false,
        has_file: true,
        estimated_hours: 3,
        value_matheus: 450.00,
        value_planning: 0.00,
        value_paschoal: 0.00,
        cost_allan_matheus: 0.00,
        cost_allan_solo: 0.00,
        cost_andrey: 0.00,
        other_internal_costs: [],
        total_value: 450.00,
        paid_value: 450.00,
        remaining_value: 0.00,
        updated_at: new Date().toISOString()
      },
      {
        id: 'CASE-202606-0003',
        dentist_id: 'dentist-3', // Dra. Monique/Iasmim
        patient_name: 'Julia Ramos',
        created_at: new Date().toISOString(),
        requested_delivery_date: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'recebido',
        financial_status: 'aguardando_pagamento',
        teeth_selection: { teeth: [14, 15, 16, 24, 25, 26], type: 'protocolo_superior' },
        dentist_notes: 'Planejar protocolo cerâmico.',
        has_photo: true,
        has_file: true,
        estimated_hours: 16,
        value_matheus: 3500.00,
        value_planning: 500.00,
        value_paschoal: 500.00,
        cost_allan_matheus: 200.00,
        cost_allan_solo: 0.00,
        cost_andrey: 100.00,
        other_internal_costs: [],
        total_value: 4500.00,
        paid_value: 1500.00,
        remaining_value: 3000.00,
        updated_at: new Date().toISOString()
      }
    ];

    const combinedCases = [...defaultCases, ...(importedCases as Case[])].map(c => {
      const year = new Date(c.created_at).getFullYear();
      if (year < 2026) {
        return {
          ...c,
          financial_status: 'pago' as const,
          paid_value: c.total_value,
          remaining_value: 0
        };
      }
      return c;
    });
    localStorage.setItem(MOCK_STORAGE_KEYS.CASES, JSON.stringify(combinedCases));
  }
}

// Perform seed on load
if (useMockData) {
  seedMockDatabase();
}

// Helper getter/setter helpers for LocalStorage
const getMockData = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveMockData = <T>(key: string, data: T[]): void => {
  localStorage.setItem(key, JSON.stringify(data));
  // Envia em segundo plano para o api.php para sincronização centralizada
  fetch(`api.php?action=set&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(err => {
    console.warn(`Falha ao salvar dados de ${key} no servidor central:`, err);
  });
};

export const recordActivity = async (action: string, caseId: string = '', newData: any = null, prevData: any = null) => {
  if (useMockData) {
    try {
      const currentUserStr = localStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
      const userId = currentUser ? currentUser.id : 'admin-1';

      const historyLogs = getMockData<CaseHistory>(MOCK_STORAGE_KEYS.HISTORY);
      const newLog: CaseHistory = {
        id: `h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        case_id: caseId,
        user_id: userId,
        action: action,
        previous_data: prevData,
        new_data: newData,
        created_at: new Date().toISOString()
      };
      historyLogs.push(newLog);
      saveMockData(MOCK_STORAGE_KEYS.HISTORY, historyLogs);
    } catch (err) {
      console.error('Error saving activity log:', err);
    }
  } else {
    try {
      const { data: { user } } = await supabase!.auth.getUser();
      if (user) {
        await supabase!.from('case_history').insert([{
          case_id: caseId || null,
          user_id: user.id,
          action: action,
          previous_data: prevData,
          new_data: newData,
          created_at: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('Error saving Supabase activity log:', err);
    }
  }
};

// =========================================================================
// API SERVICES EXPORT
// =========================================================================
export const api = {
  isMock: useMockData,

  async syncWithServer(): Promise<void> {
    if (!useMockData) return;
    const keys = Object.values(MOCK_STORAGE_KEYS);
    for (const key of keys) {
      try {
        const res = await fetch(`api.php?action=get&key=${key}`);
        if (res.ok) {
          const resJson = await res.json();
          if (resJson && resJson.success && resJson.data !== null) {
            localStorage.setItem(key, JSON.stringify(resJson.data));
          } else {
            // Se o arquivo não existir no servidor (ex: primeiro carregamento),
            // e tivermos dados semeados no LocalStorage, salvamos no servidor para subir os dados padrões!
            const localData = localStorage.getItem(key);
            if (localData) {
              await fetch(`api.php?action=set&key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: localData
              });
            }
          }
        }
      } catch (err) {
        console.warn(`Erro de sincronização para a chave ${key}:`, err);
      }
    }
  },

  // =======================================================================
  // AUTHENTICATION
  // =======================================================================
  auth: {
    async getCurrentUser(): Promise<Profile | null> {
      if (useMockData) {
        const u = localStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
        return u ? JSON.parse(u) : null;
      }

      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase!
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return profile;
    },

    async login(email: string): Promise<Profile> {
      if (useMockData) {
        const profiles = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        const query = email.toLowerCase().trim();
        // Admin Login mock: "matheus" or "admin"
        if (query.includes('matheus') || query === 'admin' || query === 'adm' || query === 'admin-1') {
          let admin = profiles.find(p => p.role === 'admin');
          if (!admin) {
            admin = {
              id: 'admin-1',
              role: 'admin',
              full_name: 'Dr. Matheus Iorczeski',
              whatsapp: '47999999999',
              pix_key: 'matheus@pix.com',
              created_at: new Date().toISOString()
            };
            profiles.push(admin);
            saveMockData(MOCK_STORAGE_KEYS.PROFILES, profiles);
          }
          localStorage.setItem(MOCK_STORAGE_KEYS.CURRENT_USER, JSON.stringify(admin));
          return admin;
        }

        // Secretary Login mock: "secretaria", "secretária" or "sec"
        if (query.includes('secretar') || query === 'secretaria' || query === 'sec' || query === 'sec-1') {
          let sec = profiles.find(p => p.role === 'secretary');
          if (!sec) {
            sec = {
              id: 'sec-1',
              role: 'secretary',
              full_name: 'Secretária Iorc Lab',
              whatsapp: '47999999998',
              created_at: new Date().toISOString()
            };
            profiles.push(sec);
            saveMockData(MOCK_STORAGE_KEYS.PROFILES, profiles);
          }
          localStorage.setItem(MOCK_STORAGE_KEYS.CURRENT_USER, JSON.stringify(sec));
          return sec;
        }

        // Dentist Login mock: find matching email slug, or default to Dr. Allan
        const nameQuery = query.split('@')[0];
        let match = profiles.find(p => 
          p.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nameQuery)
        );

        if (!match) {
          // fallback to first dentist
          match = profiles.find(p => p.role === 'dentist')!;
        }

        localStorage.setItem(MOCK_STORAGE_KEYS.CURRENT_USER, JSON.stringify(match));
        return match;
      }

      // Supabase logic: in actual Supabase we login using email & password.
      const formattedEmail = email.includes('@') ? email : `${email.trim().toLowerCase()}@iorclab.com`;
      const { error } = await supabase!.auth.signInWithPassword({
        email: formattedEmail,
        password: 'Password123'
      });

      if (error) throw error;
      const profile = await this.getCurrentUser();
      if (!profile) throw new Error('Perfil não encontrado no Supabase.');
      return profile;
    },

    async updatePassword(password: string): Promise<void> {
      if (useMockData) {
        console.log('Senha atualizada em simulação:', password);
        return;
      }
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) throw error;
    },

    async logout(): Promise<void> {
      if (useMockData) {
        localStorage.removeItem(MOCK_STORAGE_KEYS.CURRENT_USER);
        return;
      }
      await supabase!.auth.signOut();
    }
  },

  // =======================================================================
  // PROFILES / GESTÃO DE DENTISTAS (ADMIN ONLY)
  // =======================================================================
  profiles: {
    async list(): Promise<Profile[]> {
      if (useMockData) {
        const list = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        return list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
      }
      const { data, error } = await supabase!
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data;
    },

    async create(profile: Omit<Profile, 'id' | 'created_at'>): Promise<Profile> {
      if (useMockData) {
        const profiles = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        const newProfile: Profile = {
          ...profile,
          id: `dentist-${profiles.length + 1}`,
          created_at: new Date().toISOString()
        };
        profiles.push(newProfile);
        saveMockData(MOCK_STORAGE_KEYS.PROFILES, profiles);
        return newProfile;
      }
      
      // In Supabase, creating a dentist login typically requires creating an auth user 
      // (which triggers public.profiles insert via trigger)
      // For ease of admin use, we can invoke a Supabase Edge Function or custom procedure,
      // or standard profiles insertion directly if authentication registration is done.
      // Here is standard profile insert:
      const { data, error } = await supabase!
        .from('profiles')
        .insert([{ ...profile, id: genUUID() }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async save(profile: Profile): Promise<Profile> {
      if (useMockData) {
        const profiles = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        const idx = profiles.findIndex(p => p.id === profile.id);
        if (idx >= 0) {
          profiles[idx] = profile;
        } else {
          profiles.push(profile);
        }
        saveMockData(MOCK_STORAGE_KEYS.PROFILES, profiles);
        return profile;
      }
      const { data, error } = await supabase!
        .from('profiles')
        .upsert(profile)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id: string): Promise<void> {
      if (useMockData) {
        const profiles = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        const filtered = profiles.filter(p => p.id !== id);
        saveMockData(MOCK_STORAGE_KEYS.PROFILES, filtered);
        recordActivity('delete_dentist', id);
        return;
      }
      const { error } = await supabase!
        .from('profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  // =======================================================================
  // SERVICES & PRICING
  // =======================================================================
  services: {
    async list(): Promise<Service[]> {
      if (useMockData) {
        const list = getMockData<Service>(MOCK_STORAGE_KEYS.SERVICES);
        return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      }
      const { data, error } = await supabase!
        .from('services')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },

    async save(service: Service): Promise<Service> {
      if (useMockData) {
        const services = getMockData<Service>(MOCK_STORAGE_KEYS.SERVICES);
        const idx = services.findIndex(s => s.id === service.id);
        if (idx >= 0) {
          services[idx] = service;
        } else {
          service.id = service.id || `s-${Date.now()}`;
          services.push(service);
        }
        saveMockData(MOCK_STORAGE_KEYS.SERVICES, services);
        return service;
      }
      const { data, error } = await supabase!
        .from('services')
        .upsert(service)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  customPrices: {
    async list(): Promise<DentistCustomPrice[]> {
      if (useMockData) {
        return getMockData<DentistCustomPrice>(MOCK_STORAGE_KEYS.CUSTOM_PRICES);
      }
      const { data, error } = await supabase!
        .from('dentist_custom_prices')
        .select('*');
      if (error) throw error;
      return data;
    },

    async save(price: Omit<DentistCustomPrice, 'id' | 'created_at'>): Promise<DentistCustomPrice> {
      if (useMockData) {
        const prices = getMockData<DentistCustomPrice>(MOCK_STORAGE_KEYS.CUSTOM_PRICES);
        const idx = prices.findIndex(p => p.dentist_id === price.dentist_id && p.service_id === price.service_id);
        
        if (price.custom_value < 0) {
          if (idx >= 0) {
            prices.splice(idx, 1);
            saveMockData(MOCK_STORAGE_KEYS.CUSTOM_PRICES, prices);
          }
          return { id: '', dentist_id: price.dentist_id, service_id: price.service_id, custom_value: 0, created_at: '' };
        }

        const newPrice: DentistCustomPrice = {
          id: idx >= 0 ? prices[idx].id : `cp-${Date.now()}`,
          dentist_id: price.dentist_id,
          service_id: price.service_id,
          custom_value: price.custom_value,
          created_at: new Date().toISOString()
        };
        if (idx >= 0) {
          prices[idx] = newPrice;
        } else {
          prices.push(newPrice);
        }
        saveMockData(MOCK_STORAGE_KEYS.CUSTOM_PRICES, prices);
        return newPrice;
      }
      const { data, error } = await supabase!
        .from('dentist_custom_prices')
        .upsert(price, { onConflict: 'dentist_id,service_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // =======================================================================
  // CASES / TRABALHOS
  // =======================================================================
  cases: {
    async list(role: UserRole, userId: string): Promise<Case[]> {
      if (useMockData) {
        const cases = getMockData<Case>(MOCK_STORAGE_KEYS.CASES);
        if (role === 'admin' || role === 'secretary') {
          return cases;
        }
        return cases.filter(c => c.dentist_id === userId);
      }

      // If Supabase, we read from view dentist_cases or cases table depending on role
      const table = (role === 'admin' || role === 'secretary') ? 'cases' : 'dentist_cases';
      const { data, error } = await supabase!
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    async get(id: string): Promise<Case | null> {
      let currentUser: Profile | null = null;
      if (useMockData) {
        const userStr = localStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
        currentUser = userStr ? JSON.parse(userStr) : null;
      } else {
        try {
          const { data: { user } } = await supabase!.auth.getUser();
          if (user) {
            const { data: profile } = await supabase!
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            currentUser = profile;
          }
        } catch (err) {
          console.error('Erro ao buscar perfil para validacao de acesso:', err);
        }
      }

      if (useMockData) {
        const cases = getMockData<Case>(MOCK_STORAGE_KEYS.CASES);
        const caseItem = cases.find(c => c.id === id) || null;
        if (caseItem && currentUser) {
          const isAllowed = currentUser.role === 'admin' || currentUser.role === 'secretary' || caseItem.dentist_id === currentUser.id;
          if (!isAllowed) {
            throw new Error('Você não tem permissão para acessar esta pasta.');
          }
        }
        return caseItem;
      }

      const { data, error } = await supabase!
        .from('cases')
        .select('*')
        .eq('id', id)
        .single();
      if (error) return null;

      if (data && currentUser) {
        const isAllowed = currentUser.role === 'admin' || currentUser.role === 'secretary' || data.dentist_id === currentUser.id;
        if (!isAllowed) {
          throw new Error('Você não tem permissão para acessar esta pasta.');
        }
      }
      return data;
    },

    async save(caseItem: Case, _historyUser: string): Promise<Case> {
      if (useMockData) {
        const cases = getMockData<Case>(MOCK_STORAGE_KEYS.CASES);
        const isEdit = cases.some(c => c.id === caseItem.id);
        
        // Audit log action
        const oldCase = isEdit ? cases.find(c => c.id === caseItem.id) : null;
        
        caseItem.updated_at = new Date().toISOString();
        caseItem.remaining_value = caseItem.total_value - caseItem.paid_value;

        if (isEdit) {
          const idx = cases.findIndex(c => c.id === caseItem.id);
          cases[idx] = caseItem;
        } else {
          caseItem.id = caseItem.id || `CASE-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(cases.length + 1).padStart(4, '0')}`;
          caseItem.created_at = caseItem.created_at || new Date().toISOString();
          cases.unshift(caseItem);
        }
        saveMockData(MOCK_STORAGE_KEYS.CASES, cases);

        // Record history log
        recordActivity(isEdit ? 'edit' : 'create', caseItem.id, JSON.parse(JSON.stringify(caseItem)), oldCase ? JSON.parse(JSON.stringify(oldCase)) : null);

        return caseItem;
      }

      // Supabase logic: upsert case
      const { data, error } = await supabase!
        .from('cases')
        .upsert(caseItem)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id: string): Promise<void> {
      if (useMockData) {
        const cases = getMockData<Case>(MOCK_STORAGE_KEYS.CASES);
        const oldCase = cases.find(c => c.id === id);
        const filtered = cases.filter(c => c.id !== id);
        saveMockData(MOCK_STORAGE_KEYS.CASES, filtered);
        recordActivity('delete', id, null, oldCase ? JSON.parse(JSON.stringify(oldCase)) : null);
        return;
      }
      const { error } = await supabase!
        .from('cases')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  // =======================================================================
  // CALENDAR EVENTS
  // =======================================================================
  calendar: {
    async list(): Promise<CalendarEvent[]> {
      if (useMockData) {
        return getMockData<CalendarEvent>(MOCK_STORAGE_KEYS.CALENDAR_EVENTS);
      }
      const { data, error } = await supabase!
        .from('calendar_events')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data;
    },

    async save(event: CalendarEvent): Promise<CalendarEvent> {
      if (useMockData) {
        const events = getMockData<CalendarEvent>(MOCK_STORAGE_KEYS.CALENDAR_EVENTS);
        const idx = events.findIndex(e => e.id === event.id);
        const isEdit = idx >= 0;
        const oldEvent = isEdit ? events[idx] : null;
        if (isEdit) {
          events[idx] = event;
        } else {
          event.id = event.id || `ev-${Date.now()}`;
          events.push(event);
        }
        saveMockData(MOCK_STORAGE_KEYS.CALENDAR_EVENTS, events);
        recordActivity(isEdit ? 'edit_block' : 'create_block', event.id, JSON.parse(JSON.stringify(event)), oldEvent ? JSON.parse(JSON.stringify(oldEvent)) : null);
        return event;
      }
      const { data, error } = await supabase!
        .from('calendar_events')
        .upsert(event)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id: string): Promise<void> {
      if (useMockData) {
        const events = getMockData<CalendarEvent>(MOCK_STORAGE_KEYS.CALENDAR_EVENTS);
        const oldEvent = events.find(e => e.id === id);
        const filtered = events.filter(e => e.id !== id);
        saveMockData(MOCK_STORAGE_KEYS.CALENDAR_EVENTS, filtered);
        recordActivity('delete_block', id, null, oldEvent ? JSON.parse(JSON.stringify(oldEvent)) : null);
        return;
      }
      const { error } = await supabase!
        .from('calendar_events')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  // =======================================================================
  // CASE AUDIT HISTORY
  // =======================================================================
  history: {
    async list(caseId: string): Promise<CaseHistory[]> {
      if (useMockData) {
        const allLogs = getMockData<CaseHistory>(MOCK_STORAGE_KEYS.HISTORY);
        const profiles = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        return allLogs
          .filter(h => h.case_id === caseId)
          .map(h => {
            const user = profiles.find(p => p.id === h.user_id);
            return {
              ...h,
              user_name: user ? user.full_name : 'Sistema/Desconhecido'
            };
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      
      const { data, error } = await supabase!
        .from('case_history')
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map((d: any) => ({
        ...d,
        user_name: d.profiles?.full_name || 'Desconhecido'
      }));
    },

    async listAll(): Promise<CaseHistory[]> {
      if (useMockData) {
        const allLogs = getMockData<CaseHistory>(MOCK_STORAGE_KEYS.HISTORY);
        const profiles = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        return allLogs
          .map(h => {
            const user = profiles.find(p => p.id === h.user_id);
            return {
              ...h,
              user_name: user ? user.full_name : 'Sistema/Desconhecido'
            };
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      
      const { data, error } = await supabase!
        .from('case_history')
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map((d: any) => ({
        ...d,
        user_name: d.profiles?.full_name || 'Desconhecido'
      }));
    }
  },

  attachments: {
    async list(caseId: string): Promise<FileAttachment[]> {
      if (useMockData) {
        const list = getMockData<FileAttachment>(MOCK_STORAGE_KEYS.ATTACHMENTS);
        return list.filter(a => a.case_id === caseId);
      }
      const { data, error } = await supabase!
        .from('file_attachments')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },

    async upload(attachment: Omit<FileAttachment, 'id' | 'created_at'>): Promise<FileAttachment> {
      if (useMockData) {
        const list = getMockData<FileAttachment>(MOCK_STORAGE_KEYS.ATTACHMENTS);
        const newAttachment: FileAttachment = {
          ...attachment,
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          created_at: new Date().toISOString()
        };
        list.push(newAttachment);
        saveMockData(MOCK_STORAGE_KEYS.ATTACHMENTS, list);
        return newAttachment;
      }
      const { data, error } = await supabase!
        .from('file_attachments')
        .insert([{ ...attachment, id: genUUID() }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async uploadFile(
      file: File,
      caseId: string,
      patientName: string,
      dentistName: string,
      category: 'imagens' | 'escaneamento' | 'resultado',
      uploadedBy: string
    ): Promise<{ success: boolean; attachment: FileAttachment; case?: Case }> {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', caseId);
      formData.append('patient_name', patientName);
      formData.append('dentist_name', dentistName);
      formData.append('category', category);
      formData.append('uploaded_by', uploadedBy);

      const res = await fetch('api.php?action=upload_file', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Erro desconhecido no servidor';
        try {
          const errData = JSON.parse(errText);
          if (errData.error) errMsg = errData.error;
        } catch {
          errMsg = errText || `HTTP ${res.status}`;
        }
        throw new Error(errMsg);
      }

      const resJson = await res.json();
      
      if (useMockData) {
        if (resJson.attachment) {
          const list = getMockData<FileAttachment>(MOCK_STORAGE_KEYS.ATTACHMENTS);
          if (!list.some(a => a.id === resJson.attachment.id)) {
            list.push(resJson.attachment);
            localStorage.setItem(MOCK_STORAGE_KEYS.ATTACHMENTS, JSON.stringify(list));
          }
        }
        if (resJson.case) {
          const cases = getMockData<Case>(MOCK_STORAGE_KEYS.CASES);
          const idx = cases.findIndex(c => c.id === resJson.case.id);
          if (idx >= 0) {
            cases[idx] = resJson.case;
          } else {
            cases.push(resJson.case);
          }
          localStorage.setItem(MOCK_STORAGE_KEYS.CASES, JSON.stringify(cases));
        }
      }

      return resJson;
    },

    async delete(id: string): Promise<void> {
      if (useMockData) {
        const list = getMockData<FileAttachment>(MOCK_STORAGE_KEYS.ATTACHMENTS);
        const filtered = list.filter(a => a.id !== id);
        saveMockData(MOCK_STORAGE_KEYS.ATTACHMENTS, filtered);
        return;
      }
      const { error } = await supabase!
        .from('file_attachments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  gdrive: {
    async getSettings(): Promise<any> {
      if (useMockData) {
        const settings = localStorage.getItem('gdrive_shared_settings');
        return settings ? JSON.parse(settings) : null;
      }
      const { data, error } = await supabase!
        .from('gdrive_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async saveSettings(settings: {
      service_account_json: string;
      root_folder_url: string;
    }): Promise<void> {
      if (useMockData) {
        localStorage.setItem('gdrive_shared_settings', JSON.stringify(settings));
        await fetch(`api.php?action=set&key=gdrive_shared_settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        return;
      }
      const { error } = await supabase!
        .from('gdrive_settings')
        .upsert({
          id: 'default',
          ...settings,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    },

    async createCaseFolders(
      caseId: string,
      patientName: string,
      dentistName: string
    ): Promise<{
      success: boolean;
      dentistFolderId?: string;
      caseFolderId?: string;
      imagesFolderId?: string;
      scanFolderId?: string;
      resultFolderId?: string;
      caseFolderUrl?: string;
      case?: Case;
      error?: string;
    }> {
      const res = await fetch(`api.php?action=create_folders&case_id=${encodeURIComponent(caseId)}&patient_name=${encodeURIComponent(patientName)}&dentist_name=${encodeURIComponent(dentistName)}`);
      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Erro desconhecido ao criar pastas no backend';
        try {
          const errData = JSON.parse(errText);
          if (errData.error) errMsg = errData.error;
        } catch {
          errMsg = errText || `HTTP ${res.status}`;
        }
        throw new Error(errMsg);
      }
      const resJson = await res.json();
      
      if (useMockData && resJson.success && resJson.case) {
        const cases = getMockData<Case>(MOCK_STORAGE_KEYS.CASES);
        const idx = cases.findIndex(c => c.id === resJson.case.id);
        if (idx >= 0) {
          cases[idx] = resJson.case;
          localStorage.setItem(MOCK_STORAGE_KEYS.CASES, JSON.stringify(cases));
        }
      }
      
      return resJson;
    }
  },

  notes: {
    async list(): Promise<InternalNote[]> {
      if (useMockData) {
        const notes = getMockData<InternalNote>(MOCK_STORAGE_KEYS.NOTES || 'matheus_protese_notes');
        const profiles = getMockData<Profile>(MOCK_STORAGE_KEYS.PROFILES);
        return notes
          .map(n => {
            const creator = profiles.find(p => p.id === n.created_by);
            return {
              ...n,
              created_by_name: creator ? creator.full_name : 'Desconhecido'
            };
          })
          .sort((a, b) => {
            // Pinned first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            // Then sort by updated_at or created_at descending
            const timeA = new Date(a.updated_at || a.created_at).getTime();
            const timeB = new Date(b.updated_at || b.created_at).getTime();
            return timeB - timeA;
          });
      }

      const { data, error } = await supabase!
        .from('internal_notes')
        .select(`
          *,
          profiles:created_by (full_name)
        `);
      if (error) throw error;

      return (data as any[]).map((d: any) => ({
        ...d,
        created_by_name: d.profiles?.full_name || 'Desconhecido'
      })).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const timeA = new Date(a.updated_at || a.created_at).getTime();
        const timeB = new Date(b.updated_at || b.created_at).getTime();
        return timeB - timeA;
      });
    },

    async save(note: InternalNote, userId: string, userName: string): Promise<InternalNote> {
      const isEdit = !!note.id;
      note.updated_at = new Date().toISOString();
      
      const newHistoryEntry = {
        user_name: userName,
        action: isEdit ? 'Edição da nota' : 'Criação da nota',
        updated_at: note.updated_at
      };

      note.history = note.history || [];
      note.history.push(newHistoryEntry);

      if (useMockData) {
        const notes = getMockData<InternalNote>(MOCK_STORAGE_KEYS.NOTES || 'matheus_protese_notes');
        if (isEdit) {
          const idx = notes.findIndex(n => n.id === note.id);
          if (idx >= 0) {
            notes[idx] = note;
          }
        } else {
          note.id = genUUID();
          note.created_at = note.updated_at;
          note.created_by = userId;
          notes.unshift(note);
        }
        saveMockData(MOCK_STORAGE_KEYS.NOTES || 'matheus_protese_notes', notes);
        return note;
      }

      const payload = {
        ...note,
        created_by: isEdit ? note.created_by : userId,
        created_at: isEdit ? note.created_at : note.updated_at
      };
      
      // Delete client-only field before saving
      delete (payload as any).created_by_name;

      const { data, error } = await supabase!
        .from('internal_notes')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        created_by_name: userName
      };
    },

    async delete(id: string): Promise<void> {
      if (useMockData) {
        const notes = getMockData<InternalNote>(MOCK_STORAGE_KEYS.NOTES || 'matheus_protese_notes');
        const filtered = notes.filter(n => n.id !== id);
        saveMockData(MOCK_STORAGE_KEYS.NOTES || 'matheus_protese_notes', filtered);
        return;
      }
      const { error } = await supabase!
        .from('internal_notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  }
};

function genUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
