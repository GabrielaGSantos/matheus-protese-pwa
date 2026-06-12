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

const AppContent: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  // Sync default tab when user profile loads
  useEffect(() => {
    if (user) {
      setCurrentTab(isAdmin ? 'dashboard' : 'dentist-cases');
    }
  }, [user, isAdmin]);

  const handleSelectCase = (caseId: string) => {
    setEditingCaseId(caseId);
    setCurrentTab('cases');
  };

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
        case 'cases':
          return (
            <CasesScreen 
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
        default:
          return <DashboardScreen onSelectCase={handleSelectCase} />;
      }
    } else {
      switch (currentTab) {
        case 'dentist-cases':
          return <DentistDashboard key="my-cases" initialTab="my-cases" />;
        case 'dentist-new-case':
          return <DentistDashboard key="new-case" initialTab="new-case" />;
        default:
          return <DentistDashboard key="default" initialTab="my-cases" />;
      }
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
