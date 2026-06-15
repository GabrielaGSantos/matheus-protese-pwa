import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthScreen } from './components/AuthScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { CasesScreen } from './components/CasesScreen';
import { DentistsScreen } from './components/DentistsScreen';
import { ServicesScreen } from './components/ServicesScreen';
import { FinanceScreen } from './components/FinanceScreen';
import { AgendaScreen } from './components/AgendaScreen';
import { DentistDashboard } from './components/DentistDashboard';
import { LogsScreen } from './components/LogsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { NotesScreen } from './components/NotesScreen';
import { notificationService } from './services/notifications';
import { api } from './services/api';

const AppContent: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  // Sincroniza dados com o servidor local centralizado e inicializa defaults do Drive
  useEffect(() => {
    const syncDb = async () => {
      try {
        await api.syncWithServer();
      } catch (err) {
        console.error('Falha de sincronização do banco central:', err);
      }
    };
    syncDb();

    if (!localStorage.getItem('google_drive_root_url')) {
      localStorage.setItem('google_drive_root_url', 'https://drive.google.com/drive/folders/1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN?usp=sharing');
    }
    if (!localStorage.getItem('google_drive_root_folder_id')) {
      localStorage.setItem('google_drive_root_folder_id', '1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN');
    }
  }, []);

  // Sync default tab when user profile loads
  useEffect(() => {
    if (user) {
      setCurrentTab(isAdmin ? 'dashboard' : 'dentist-cases');
    }
  }, [user, isAdmin]);

  // Redireciona a seleção do caso baseado no status dele
  const handleSelectCase = async (caseId: string) => {
    setEditingCaseId(caseId);
    try {
      const casesList = await api.cases.list('admin', user?.id || 'admin-1');
      const found = casesList.find(c => c.id === caseId);
      if (found && found.status === 'entregue') {
        setCurrentTab('cases-delivered');
      } else {
        setCurrentTab('cases-open');
      }
    } catch {
      setCurrentTab('cases-open');
    }
  };

  // Verifica casos próximos do vencimento (menores que 48 horas de prazo de entrega final)
  const checkImpendingDeadlines = async () => {
    if (!isAdmin || !user) return;
    try {
      const casesList = await api.cases.list('admin', user.id);
      const today = new Date();
      
      const notifiedStr = localStorage.getItem('matheus_protese_deadlines_notified');
      const notifiedIds: string[] = notifiedStr ? JSON.parse(notifiedStr) : [];
      const newlyNotified = [...notifiedIds];
      let hasNewNotification = false;

      for (const c of casesList) {
        // Ignorar finalizados, entregues e cancelados
        if (['finalizado', 'entregue', 'cancelado'].includes(c.status)) continue;
        
        const deliveryDateStr = c.final_delivery_date || c.requested_delivery_date;
        if (!deliveryDateStr) continue;

        const deliveryDate = new Date(deliveryDateStr + 'T23:59:59');
        const diffTime = deliveryDate.getTime() - today.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        // Menos de 48h (2 dias)
        if (diffDays >= 0 && diffDays <= 2) {
          if (!notifiedIds.includes(c.id)) {
            notificationService.add(
              'Prazo Próximo do Vencimento',
              `O caso do paciente "${c.patient_name}" vence em ${new Date(deliveryDateStr).toLocaleDateString('pt-BR')} (menos de 48h).`,
              'due_date',
              c.id
            );
            newlyNotified.push(c.id);
            hasNewNotification = true;
          }
        }
      }

      if (hasNewNotification) {
        localStorage.setItem('matheus_protese_deadlines_notified', JSON.stringify(newlyNotified));
      }
    } catch (err) {
      console.error('Erro ao verificar prazos de vencimento:', err);
    }
  };

  // Executar checagem de vencimento no mount do app e a cada 4 horas
  useEffect(() => {
    if (user && isAdmin) {
      checkImpendingDeadlines();
      const interval = setInterval(checkImpendingDeadlines, 4 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  // Capturar evento customizado de abertura de editor de casos pelo sino
  useEffect(() => {
    const handleOpenEditor = (e: Event) => {
      const caseId = (e as CustomEvent).detail;
      if (caseId) {
        setEditingCaseId(caseId);
      }
    };
    window.addEventListener('open_case_editor', handleOpenEditor);
    return () => window.removeEventListener('open_case_editor', handleOpenEditor);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center text-white text-xl font-bold animate-spin shadow-lg">
          M
        </div>
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">
          Carregando informações seguras...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Render correct screen content based on role and active tab
  const renderContent = () => {
    if (isAdmin) {
      switch (currentTab) {
        case 'dashboard':
          return <DashboardScreen onSelectCase={handleSelectCase} />;
        case 'cases-open':
          return (
            <CasesScreen 
              key="cases-open"
              filterType="open"
              initialEditingCaseId={editingCaseId} 
              clearInitialEditingCaseId={() => setEditingCaseId(null)} 
            />
          );
        case 'cases-delivered':
          return (
            <CasesScreen 
              key="cases-delivered"
              filterType="delivered"
              initialEditingCaseId={editingCaseId} 
              clearInitialEditingCaseId={() => setEditingCaseId(null)} 
            />
          );
        case 'dentists':
          return <DentistsScreen />;
        case 'services':
          return <ServicesScreen />;
        case 'finance':
          return <FinanceScreen />;
        case 'agenda':
          return <AgendaScreen onSelectCase={handleSelectCase} />;
        case 'logs':
          return <LogsScreen />;
        case 'notes':
          return <NotesScreen />;
        case 'settings':
          return <SettingsScreen />;
        default:
          return <DashboardScreen onSelectCase={handleSelectCase} />;
      }
    } else {
      return <DentistDashboard currentTab={currentTab} setCurrentTab={setCurrentTab} />;
    }
  };

  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderContent()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
