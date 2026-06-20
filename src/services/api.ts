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
// import importedCases from './imported_cases.json';

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
    localStorage.setItem(MOCK_STORAGE_KEYS.CASES, JSON.stringify([]));
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
      let profile: Profile | null = null;
      if (useMockData) {
        const u = localStorage.getItem(MOCK_STORAGE_KEYS.CURRENT_USER);
        profile = u ? JSON.parse(u) : null;
      } else {
        const { data: { user } } = await supabase!.auth.getUser();
        if (user) {
          const { data: prof } = await supabase!
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          profile = prof;
        }
      }

      if (profile) {
        // Sync PHP session
        await fetch('api.php?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        }).catch(err => console.warn('Erro ao sincronizar sessão no backend:', err));
      }

      return profile;
    },

    async login(email: string, password?: string): Promise<Profile> {
      let profile: Profile;
      if (useMockData) {
        if (password !== 'cad_123456') {
          throw new Error('Senha incorreta.');
        }

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
          profile = admin;
        } else if (query.includes('secretar') || query === 'secretaria' || query === 'sec' || query === 'sec-1') {
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
          profile = sec;
        } else if (query.startsWith('aux_') || query.startsWith('auxiliar_') || query.includes('auxiliar')) {
          // Auxiliar login - extract dentist name from query
          const dentistPart = query.replace('aux_', '').replace('auxiliar_', '').replace('auxiliar', '').trim();
          
          // Find the linked dentist
          let linkedDentist = profiles.find(p => 
            p.role === 'dentist' && p.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(dentistPart)
          );
          if (!linkedDentist) {
            linkedDentist = profiles.find(p => p.role === 'dentist');
          }
          
          if (linkedDentist) {
            const auxId = `aux-${linkedDentist.id}`;
            let auxProfile = profiles.find(p => p.id === auxId);
            if (!auxProfile) {
              auxProfile = {
                id: auxId,
                role: 'auxiliar' as any,
                full_name: `Auxiliar - ${linkedDentist.full_name}`,
                linked_dentist_id: linkedDentist.id,
                created_at: new Date().toISOString()
              };
              profiles.push(auxProfile);
              saveMockData(MOCK_STORAGE_KEYS.PROFILES, profiles);
            }
            profile = auxProfile;
          } else {
            throw new Error('Nenhum dentista encontrado para vincular o auxiliar.');
          }
        } else {
          const nameQuery = query.split('@')[0];
          let match = profiles.find(p => 
            p.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nameQuery)
          );
          if (!match) {
            match = profiles.find(p => p.role === 'dentist')!;
          }
          profile = match;
        }
        localStorage.setItem(MOCK_STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
      } else {
        const formattedEmail = email.includes('@') ? email : `${email.trim().toLowerCase()}@iorclab.com`;
        const { error } = await supabase!.auth.signInWithPassword({
          email: formattedEmail,
          password: password || 'cad_123456'
        });
        if (error) throw error;
        
        const { data: { user } } = await supabase!.auth.getUser();
        if (!user) throw new Error('Usuário não encontrado após login no Supabase.');
        const { data: prof } = await supabase!
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (!prof) throw new Error('Perfil do Supabase não encontrado.');
        profile = prof;
      }

      // Sync PHP session
      await fetch('api.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      }).catch(err => console.warn('Erro ao sincronizar login no backend:', err));

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
      } else {
        await supabase!.auth.signOut();
      }
      // Sync PHP session
      await fetch('api.php?action=logout').catch(err => console.warn('Erro ao limpar sessão de logout no backend:', err));
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
      
      let finalId = crypto.randomUUID() as string;
      let generatedEmail = '';
      let generatedPassword = '';
      if (!useMockData) {
        generatedPassword = Math.random().toString(36).substring(2, 8).toLowerCase(); // 6 random characters
      }

      try {
        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });
        
        let emailBase = profile.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        if (profile.role === 'auxiliar') emailBase = 'auxiliar_' + emailBase;
        generatedEmail = `${emailBase}@iorclab.com`;
        
        const { data: authData, error: authErr } = await tempClient.auth.signUp({
          email: generatedEmail,
          password: generatedPassword
        });

        if (authErr) {
            if (authErr.message.includes('User already registered') || authErr.message.includes('already registered')) {
              // Try to find if user exists by checking the profiles table directly
              const { data: existingProfile } = await supabase!
                .from('profiles')
                .select('id')
                .ilike('full_name', profile.full_name)
                .single();
              
              if (existingProfile) {
                finalId = existingProfile.id;
                // If the profile already exists, we should probably throw or just overwrite it.
                // Since the user is explicitly trying to recreate, let's just proceed.
              } else {
                 throw new Error(`O usuário já existe, mas o perfil não foi encontrado. Utilize a função de Resetar Senha.`);
              }
            } else {
              console.error('Erro ao criar Auth User:', authErr);
              throw new Error(`Erro ao criar login. O Supabase recusou: ${authErr.message}`);
            }
        } else if (authData.user) {
          finalId = authData.user.id;
        }
      } catch (e) {
        console.error('Erro no registro do auth:', e);
        throw e;
      }

      const { data, error } = await supabase!
        .from('profiles')
        .upsert([{ ...profile, id: finalId }])
        .select()
        .single();
        
      if (error) throw error;
      
      return { ...data, _generatedEmail: generatedEmail, _generatedPassword: generatedPassword } as any;
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

    async resetPassword(userId: string): Promise<string> {
      if (useMockData) return 'senha_mock';
      const newPassword = Math.random().toString(36).substring(2, 8).toLowerCase();
      
      const { data, error } = await supabase!.functions.invoke('admin-actions', {
        body: { action: 'reset_password', userId: userId, password: newPassword }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return newPassword;
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
          caseItem.id = caseItem.id || crypto.randomUUID();
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
        
        // Limpar órfãos (arquivos e histórico)
        const attachments = getMockData<any>(MOCK_STORAGE_KEYS.ATTACHMENTS);
        const filteredAtts = attachments.filter((a: any) => a.case_id !== id);
        saveMockData(MOCK_STORAGE_KEYS.ATTACHMENTS, filteredAtts);
        
        const historyData = getMockData<any>(MOCK_STORAGE_KEYS.HISTORY);
        const filteredHist = historyData.filter((h: any) => h.case_id !== id);
        saveMockData(MOCK_STORAGE_KEYS.HISTORY, filteredHist);
        
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
        return list.filter(a => 
          a.case_id === caseId && 
          a.google_drive_file_id && 
          !a.google_drive_file_id.startsWith('gfile-error') && 
          a.file_name && 
          !a.file_name.includes('Falha no envio') && 
          a.web_view_link && 
          a.folder_id
        );
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
      category: 'imagens' | 'escaneamento' | 'enceramento_digital' | 'resultado',
      uploadedBy: string
    ): Promise<{ success: boolean; attachment: FileAttachment; case?: Case }> {
      console.debug(`[Upload File] Case ID: ${caseId}, Patient: ${patientName}, Dentist: ${dentistName}, Category: ${category}, Uploaded By: ${uploadedBy}`);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', caseId);
      formData.append('patient_name', patientName);
      formData.append('dentist_name', dentistName);
      formData.append('dentist_id', uploadedBy); // Temporary mapping
      formData.append('uploaded_by', uploadedBy);
      formData.append('category', category);

      const { data, error } = await supabase!.functions.invoke('gdrive-upload', {
        body: formData,
      });

      if (error) {
        console.error('Erro na Edge Function gdrive-upload:', error);
        throw new Error(`Erro ao enviar arquivo: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido ao enviar arquivo.');
      }

      return data;
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
      const { data, error } = await supabase!
        .from('gdrive_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return {
        ...data,
        drive_connected: !!data?.refresh_token
      };
    },

    async saveSettings(settings: { root_folder_url?: string; root_folder_id?: string }): Promise<void> {
      const { error } = await supabase!
        .from('gdrive_config')
        .upsert({
          id: 1,
          root_folder_id: settings.root_folder_id || settings.root_folder_url
        });
      if (error) throw error;
    },

    async getAuthUrl(): Promise<string> {
      if (!supabase) throw new Error('Supabase não configurado. Adicione VITE_SUPABASE_URL e KEY no arquivo .env para testar localmente.');
      const { data, error } = await supabase.functions.invoke('gdrive-auth', {
        body: { action: 'auth' }
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Não foi possível gerar a URL de autenticação.');
      return data.url;
    },

    async disconnect(): Promise<any> {
      const { error } = await supabase!
        .from('gdrive_config')
        .update({ refresh_token: null })
        .eq('id', 1);
      if (error) throw error;
      return { success: true };
    },

    async createCaseFolders(
      caseId: string,
      patientName: string,
      dentistName: string
    ): Promise<{ success: boolean; caseFolderId?: string; error?: string }> {
      const formData = new FormData();
      formData.append('action', 'create_folders');
      formData.append('case_id', caseId);
      formData.append('patient_name', patientName);
      formData.append('dentist_name', dentistName);

      const { data, error } = await supabase!.functions.invoke('gdrive-upload', {
        body: formData,
      });

      if (error) {
        console.error('Erro na Edge Function criar pastas:', error);
        return { success: false, error: error.message };
      }
      return data;
    },

    async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
      const formData = new FormData();
      formData.append('action', 'test_connection');
      formData.append('case_id', 'test');
      formData.append('dentist_id', 'test');
      formData.append('dentist_name', 'Test');
      formData.append('patient_name', 'Test');

      const { data, error } = await supabase!.functions.invoke('gdrive-upload', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message || 'Erro na Edge Function');
      }
      return data;
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
