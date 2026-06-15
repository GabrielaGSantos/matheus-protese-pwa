import React, { useState, useEffect, useRef } from 'react';
import { api, recordActivity } from '../services/api';
import { notificationService } from '../services/notifications';
import { useAuth } from '../context/AuthContext';
import type { AppNotification, NotificationSettings, CaseHistory, Profile, Case } from '../types';
import { 
  Bell, 
  Send, 
  Trash2, 
  Settings, 
  AlertTriangle,
  FileDown,
  FolderOpen,
  Wifi,
  WifiOff,
  Loader2,
  History,
  ChevronLeft,
  ChevronRight,
  User,
  Search,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const SettingsScreen: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'profile' | 'gdrive' | 'import' | 'notifications' | 'telegram' | 'logs'>('profile');

  // General Data State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [pixKey, setPixKey] = useState(user?.pix_key || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Google Drive Config States
  const [driveRootLink, setDriveRootLink] = useState('https://drive.google.com/drive/folders/1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN?usp=sharing');
  const [extractedFolderId, setExtractedFolderId] = useState('');
  const [driveTestResult, setDriveTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [dbDriveConnected, setDbDriveConnected] = useState(false);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [isExchangingCode, setIsExchangingCode] = useState(false);
  const [driveStructure, setDriveStructure] = useState<{ root_folder: { id: string; name: string }; dentist_folders: { id: string; name: string; cases_count: number }[] } | null>(null);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const driveConnected = dbDriveConnected;

  // Telegram/Notification States
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(notificationService.getSettings());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [telegramTestStatus, setTelegramTestStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Logs state
  const [logs, setLogs] = useState<CaseHistory[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const logsItemsPerPage = 20;

  useEffect(() => {
    const id = extractFolderId(driveRootLink);
    setExtractedFolderId(id);
  }, [driveRootLink]);

  // Carregar configurações do Google Drive compartilhadas do banco de dados
  const fetchGDriveSettings = async () => {
    try {
      const settings = await api.gdrive.getSettings();
      if (settings) {
        if (settings.root_folder_url) {
          setDriveRootLink(settings.root_folder_url);
          const id = extractFolderId(settings.root_folder_url);
          setExtractedFolderId(id);
        }
        if (settings.client_email) {
          setClientEmail(settings.client_email);
        }
        
        setOauthClientId(settings.oauth_client_id || '');
        setDbDriveConnected(!!settings.drive_connected);
        if (settings.drive_connected || settings.oauth_client_id) {
          setOauthClientSecret('********');
        } else {
          setOauthClientSecret('');
        }
      }
    } catch (err) {
      console.error('Erro ao buscar configurações do Google Drive no banco:', err);
    }
  };

  useEffect(() => {
    setNotifications(notificationService.list());
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
    fetchLogs();
    fetchGDriveSettings();

    // Lógica para detectar código de autorização do Google Drive OAuth 2.0
    const checkOAuthCode = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      if (code && state === 'settings') {
        setIsExchangingCode(true);
        try {
          const redirectUri = window.location.origin + '/settings';
          const updatedSettings = await api.gdrive.exchangeCode(code, redirectUri);
          alert('✅ Conta Google conectada com sucesso ao Google Drive!');
          
          // Limpar a URL do navegador removendo os parâmetros do OAuth
          window.history.replaceState({}, '', window.location.origin + window.location.pathname);
          
          if (updatedSettings) {
            setClientEmail(updatedSettings.client_email || '');
            setOauthClientId(updatedSettings.oauth_client_id || '');
            setDbDriveConnected(!!updatedSettings.drive_connected);
            setOauthClientSecret('********');
          }
        } catch (err: any) {
          alert('❌ Erro ao autorizar conta Google: ' + err.message);
        } finally {
          setIsExchangingCode(false);
        }
      }
    };
    checkOAuthCode();
  }, []);

  const extractFolderId = (url: string) => {
    const matchFolders = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (matchFolders) return matchFolders[1];
    const matchId = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (matchId) return matchId[1];
    return '';
  };

  const formatLogDate = (dateStr: string) => {
    if (!dateStr) return { date: '-', time: '-' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '-', time: '-' };
    return {
      date: d.toLocaleDateString('pt-BR'),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const updatedProfile: Profile = {
        ...user,
        full_name: fullName,
        whatsapp: whatsapp,
        pix_key: pixKey
      };
      await api.profiles.save(updatedProfile);
      alert('Dados gerais atualizados com sucesso! (Recarregue para aplicar no menu lateral)');
    } catch (err: any) {
      alert('Erro ao salvar dados gerais: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveDriveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const folderId = extractFolderId(driveRootLink);
    if (!folderId) {
      alert('Por favor, insira um link válido do Google Drive contendo o ID da pasta.');
      return false;
    }
    
    if (!oauthClientId.trim()) {
      alert('Por favor, insira o Client ID.');
      return false;
    }

    if (!oauthClientSecret.trim()) {
      alert('Por favor, insira o Client Secret.');
      return false;
    }

    try {
      setDriveLoading(true);
      await api.gdrive.saveOauthConfig(
        oauthClientId.trim(),
        oauthClientSecret.trim(),
        driveRootLink
      );
      alert('Configurações do Google Drive salvas com sucesso!');
      await fetchGDriveSettings();
      return true;
    } catch (err: any) {
      alert('Erro ao salvar configurações no banco: ' + err.message);
      return false;
    } finally {
      setDriveLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    const saved = await handleSaveDriveConfig();
    if (!saved) return;

    const redirectUri = encodeURIComponent(window.location.origin + '/settings');
    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${oauthClientId.trim()}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=settings`;
    
    window.location.href = authUrl;
  };

  const handleDisconnectDrive = async () => {
    if (window.confirm('Tem certeza de que deseja desconectar a conta do Google Drive?')) {
      setDriveLoading(true);
      try {
        await api.gdrive.disconnect();
        alert('Conta Google desconectada com sucesso.');
        setOauthClientId('');
        setOauthClientSecret('');
        setClientEmail('');
        setDbDriveConnected(false);
      } catch (err: any) {
        alert('Erro ao desconectar: ' + err.message);
      } finally {
        setDriveLoading(false);
      }
    }
  };

  const handleTestConnection = async () => {
    setDriveLoading(true);
    setDriveTestResult(null);
    try {
      const res = await fetch('api.php?action=test_drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_folder_url: driveRootLink
        })
      });
      
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Resposta não-JSON do servidor: ${text.substring(0, 200)}`);
      }
      
      const resJson = await res.json();
      if (resJson.success) {
        setDriveTestResult({
          success: true,
          message: resJson.message || '✅ Conexão estabelecida com sucesso!',
        });
        setDbDriveConnected(true);
      } else {
        setDriveTestResult({
          success: false,
          message: `❌ ${resJson.error || 'Erro de conexão.'}`,
        });
      }
    } catch (err: any) {
      setDriveTestResult({ success: false, message: `❌ ${err.message}` });
    } finally {
      setDriveLoading(false);
    }
  };

  const handleViewStructure = async () => {
    setLoadingStructure(true);
    setDriveStructure(null);
    setShowStructureModal(true);
    try {
      const headers: Record<string, string> = {};
      let userIdQuery = '';
      if (user && user.id) {
        headers['X-User-Id'] = user.id;
        userIdQuery = `&user_id=${encodeURIComponent(user.id)}`;
      }
      const res = await fetch(`api.php?action=view_drive_structure${userIdQuery}`, {
        headers
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Resposta não-JSON do servidor: ${text.substring(0, 200)}`);
      }
      const resJson = await res.json();
      if (resJson.success) {
        setDriveStructure(resJson);
      } else {
        alert(`❌ Erro ao ler estrutura: ${resJson.error}`);
        setShowStructureModal(false);
      }
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
      setShowStructureModal(false);
    } finally {
      setLoadingStructure(false);
    }
  };

  // Spreadsheet Import Handlers
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const fileData = evt.target?.result;
        if (!fileData) return;

        const workbook = XLSX.read(fileData, { type: 'array' });
        const targetSheets = [
          'Maio26', 'Abril26', 'Março26', 'Fevereiro26', 'Janeiro26',
          'Dezembro25', 'Novembro25', 'Outubro25', 'Setembro25', 'Agosto25',
          'Junho e Julho25', 'Abril25', 'Março25'
        ];

        const getJsDate = (excelSerial: any) => {
          if (!excelSerial) return new Date().toISOString();
          if (typeof excelSerial === 'string') {
            const d = new Date(excelSerial);
            return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          }
          const date = new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
          return date.toISOString();
        };

        const profiles: Profile[] = JSON.parse(localStorage.getItem('matheus_protese_profiles') || '[]');
        const dentistNameMap: Record<string, string> = {};

        profiles.forEach(p => {
          if (p.role === 'dentist') {
            const norm = p.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            dentistNameMap[norm] = p.id;
          }
        });

        const allCases: Case[] = [];
        let caseCount = 1;

        workbook.SheetNames.forEach(sheetName => {
          if (!targetSheets.includes(sheetName)) return;
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

          rows.forEach((row, idx) => {
            const clientName = String(row['Cliente'] || '').trim();
            if (!clientName) return;

            const normClient = clientName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            let dentistId = dentistNameMap[normClient];

            if (!dentistId) {
              dentistId = `dentist-dynamic-${normClient || 'unknown'}`;
              const newProfile: Profile = {
                id: dentistId,
                role: 'dentist',
                full_name: clientName,
                whatsapp: '',
                created_at: new Date().toISOString()
              };
              profiles.push(newProfile);
              dentistNameMap[normClient] = dentistId;
            }

            const rawDate = row['Data Recebido'] || row['Data'] || row['data'] || row['Data recebido'];
            const isoDateStr = getJsDate(rawDate);
            const datePart = isoDateStr.split('T')[0];
            const yearMonth = datePart.slice(0, 7).replace('-', '');

            const caseId = `CASE-${yearMonth}-${String(caseCount++).padStart(4, '0')}`;

            const valueMatheus = parseFloat(row['Valor Matheus']) || 0;
            const valuePlanning = parseFloat(row['Valor Planning']) || 0;
            const valuePaschoal = parseFloat(row['Valor Paschoal']) || 0;
            const costAllanMatheus = parseFloat(row['Allan/Matheus']) || 0;
            const costAllanSolo = parseFloat(row['Allan Solo']) || 0;
            const costAndrey = parseFloat(row['Andrey']) || 0;

            const calculatedTotal = valueMatheus + valuePlanning + valuePaschoal;
            const statusText = String(row['Status'] || 'Aguardando Pagamento').toLowerCase();

            const caseYear = new Date(isoDateStr).getFullYear();
            let financialStatus: 'pago' | 'isento' | 'aguardando_pagamento' = 'aguardando_pagamento';
            if (caseYear < 2026) {
              financialStatus = 'pago';
            } else if (statusText.includes('pago')) {
              financialStatus = 'pago';
            } else if (statusText.includes('isento')) {
              financialStatus = 'isento';
            }

            allCases.push({
              id: caseId,
              dentist_id: dentistId,
              patient_name: String(row['Paciente'] || 'Sem Nome'),
              created_at: isoDateStr,
              requested_delivery_date: datePart,
              final_delivery_date: datePart,
              status: 'finalizado',
              financial_status: financialStatus,
              teeth_selection: { teeth: [], type: 'individual' },
              dentist_notes: String(row['Observações'] || ''),
              internal_notes: `Feito por: ${row['Feito por'] || 'N/A'}`,
              has_photo: false,
              has_file: false,
              estimated_hours: 0,
              value_matheus: valueMatheus,
              value_planning: valuePlanning,
              value_paschoal: valuePaschoal,
              cost_allan_matheus: costAllanMatheus,
              cost_allan_solo: costAllanSolo,
              cost_andrey: costAndrey,
              other_internal_costs: [],
              total_value: calculatedTotal,
              paid_value: financialStatus === 'pago' ? calculatedTotal : 0,
              remaining_value: financialStatus === 'pago' ? 0 : calculatedTotal,
              google_drive_folder_id: `folder-imported-${idx}`,
              google_drive_folder_url: 'https://drive.google.com/drive/folders/1-Rpx_mQbBNRuLQZfj6f0A_TBao-aZHrN?usp=sharing',
              updated_at: isoDateStr
            });
          });
        });

        // Save
        localStorage.setItem('matheus_protese_profiles', JSON.stringify(profiles));
        localStorage.setItem('matheus_protese_cases', JSON.stringify(allCases));

        await recordActivity('importacao', '', { count: allCases.length });
        alert(`Planilha importada com sucesso! ${allCases.length} casos e novos dentistas foram carregados.`);
        fetchLogs();
      } catch (err: any) {
        console.error(err);
        alert('Erro ao processar a planilha. Verifique o formato do arquivo.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Telegram Notifications Handlers
  const handleTogglePush = async (checked: boolean) => {
    if (checked && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') {
        alert('Você precisa conceder permissões de notificação no seu navegador para usar o Push.');
        return;
      }
    }
    const updated = { ...notifSettings, enable_push: checked };
    setNotifSettings(updated);
    notificationService.saveSettings(updated);
  };

  const handleToggleEmail = (checked: boolean) => {
    const updated = { ...notifSettings, enable_email: checked };
    setNotifSettings(updated);
    notificationService.saveSettings(updated);
  };

  const handleToggleTelegram = (checked: boolean) => {
    const updated = { ...notifSettings, enable_telegram: checked };
    setNotifSettings(updated);
    notificationService.saveSettings(updated);
  };

  const handleSaveTelegramConfig = (e: React.FormEvent) => {
    e.preventDefault();
    notificationService.saveSettings(notifSettings);
    alert('Configurações de integração com Telegram salvas com sucesso!');
  };

  const handleTestTelegram = () => {
    if (!notifSettings.telegram_bot_token || !notifSettings.telegram_chat_id) {
      setTelegramTestStatus({ type: 'error', message: 'Preencha o Token do Bot e o Chat ID para testar.' });
      return;
    }
    
    setTelegramTestStatus({ type: null, message: '' });
    const text = `🔌 *Teste de Conexão do Bot*\n\nParabéns! O bot do Telegram foi conectado com sucesso ao painel *Sistema Dr Matheus - Iorc Lab*!`;
    const url = `https://api.telegram.org/bot${notifSettings.telegram_bot_token}/sendMessage`;
    
    const chatIds = notifSettings.telegram_chat_id
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (chatIds.length === 0) {
      setTelegramTestStatus({ type: 'error', message: 'Nenhum Chat ID válido encontrado.' });
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let processed = 0;

    chatIds.forEach(chatId => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      })
      .then(res => {
        processed++;
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
        
        if (processed === chatIds.length) {
          if (failCount === 0) {
            setTelegramTestStatus({ 
              type: 'success', 
              message: `Mensagem de teste enviada com sucesso para ${successCount} destinatário(s)!` 
            });
          } else {
            setTelegramTestStatus({ 
              type: 'error', 
              message: `Envio concluído: ${successCount} com sucesso, ${failCount} falhou. Verifique as credenciais.` 
            });
          }
        }
      })
      .catch(err => {
        processed++;
        failCount++;
        if (processed === chatIds.length) {
          setTelegramTestStatus({ 
            type: 'error', 
            message: `Falha na conexão: ${err.message}. Envios com sucesso: ${successCount}` 
          });
        }
      });
    });
  };

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead();
    setNotifications(notificationService.list());
  };

  const handleClearAllNotif = () => {
    if (window.confirm('Tem certeza de que deseja limpar todo o histórico de notificações?')) {
      notificationService.clearAll();
      setNotifications([]);
    }
  };

  // Activity Logs Handlers
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await (api.history as any).listAll();
      setLogs(data);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLogsLoading(false);
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
    const term = logsSearch.toLowerCase();
    const desc = getLogDescription(log).toLowerCase();
    const userName = (log.user_name || '').toLowerCase();
    const caseId = (log.case_id || '').toLowerCase();
    return desc.includes(term) || userName.includes(term) || caseId.includes(term);
  });

  const logsTotalPages = Math.max(1, Math.ceil(filteredLogs.length / logsItemsPerPage));
  const paginatedLogs = filteredLogs.slice(
    (logsCurrentPage - 1) * logsItemsPerPage,
    logsCurrentPage * logsItemsPerPage
  );

  const getNotifCategoryBadge = (cat: AppNotification['category']) => {
    const styles: Record<AppNotification['category'], { label: string; style: string }> = {
      new_case: { label: 'Novo Caso', style: 'bg-blue-50 text-blue-700 border-blue-100' },
      case_modified: { label: 'Caso Alterado', style: 'bg-amber-50 text-amber-700 border-amber-100' },
      file_uploaded: { label: 'Arquivo Enviado', style: 'bg-teal-50 text-teal-700 border-teal-100' },
      case_approved: { label: 'Caso Aprovado', style: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
      case_finished: { label: 'Caso Finalizado', style: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
      due_date: { label: 'Vencimento', style: 'bg-rose-50 text-rose-700 border-rose-100' }
    };
    const config = styles[cat] || { label: 'Geral', style: 'bg-slate-50 text-slate-700 border-slate-100' };
    return (
      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${config.style}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* Header */}
      <div className="pb-4 border-b border-[#E2E8F0]">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-[#0F766E]" size={26} />
          Configurações do Sistema
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Painel administrativo unificado para gerenciar dados, integrações, importações, notificações e logs de auditoria.
        </p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-[#E2E8F0] gap-6 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'profile'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <User size={15} />
          Dados Gerais
        </button>
        <button
          onClick={() => setActiveTab('gdrive')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'gdrive'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FolderOpen size={15} />
          Google Drive
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'import'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileDown size={15} />
          Importar Planilha
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'notifications'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Bell size={15} />
          Notificações
        </button>
        <button
          onClick={() => setActiveTab('telegram')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'telegram'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Send size={15} />
          Telegram
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History size={15} />
          Logs de Auditoria
        </button>
      </div>

      {/* Tabs Content */}
      <div className="glass-panel p-6 rounded-2xl border border-[#E2E8F0] shadow-sm bg-white min-h-[400px]">

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Meus Dados Administrativos</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  WhatsApp (Contato)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 554899999999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Chave Pix (Para recebimentos)
                </label>
                <input
                  type="text"
                  placeholder="Ex: CNPJ, E-mail ou Celular"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? 'Salvando...' : 'Salvar Dados Gerais'}
            </button>
          </form>
        )}

        {/* GOOGLE DRIVE CONFIG TAB */}
        {activeTab === 'gdrive' && (
          <div className="space-y-6 max-w-2xl animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900">Integração do Google Drive via OAuth de Usuário</h3>
              {isExchangingCode && (
                <div className="flex items-center gap-1.5 text-xs text-[#0F766E] font-semibold">
                  <Loader2 className="animate-spin" size={14} />
                  Conectando conta Google...
                </div>
              )}
            </div>
            
            {/* Connection Status Card */}
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              driveConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}>
              <div className="flex items-center gap-3">
                {driveConnected ? (
                  <Wifi size={20} className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <WifiOff size={20} className="text-rose-500 flex-shrink-0" />
                )}
                <div>
                  <div className={`text-xs font-bold ${driveConnected ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {driveConnected 
                      ? `Google Drive Conectado como [${clientEmail}]`
                      : 'Google Drive Pendente de Conexão'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {driveConnected 
                      ? 'Os uploads de arquivos consumirão a quota de armazenamento desta conta.'
                      : 'Salve suas credenciais abaixo e conecte sua conta Google para ativar a sincronização.'}
                  </div>
                </div>
              </div>
              {driveConnected && (
                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  disabled={driveLoading}
                  className="px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer border border-rose-200"
                >
                  Desconectar Conta
                </button>
              )}
            </div>

            {/* Connection Feedback / Results */}
            {driveTestResult && (
              <div className={`p-3 rounded-lg border text-[11px] font-semibold ${
                driveTestResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {driveTestResult.message}
              </div>
            )}

            {/* Actions block */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={driveLoading || isExchangingCode}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F766E] rounded-lg hover:bg-[#115E59] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {driveLoading ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                Conectar conta Google
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={driveLoading || !driveConnected || isExchangingCode}
                className="px-4 py-2 text-xs font-bold text-[#0F766E] bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {driveLoading ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                Testar Upload
              </button>

              {driveConnected && (
                <button
                  type="button"
                  onClick={handleViewStructure}
                  disabled={loadingStructure || isExchangingCode}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingStructure ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                  Visualizar Estrutura do Drive
                </button>
              )}
            </div>

            {/* General Settings Form */}
            <form onSubmit={handleSaveDriveConfig} className="space-y-4 pt-4 border-t border-[#E2E8F0]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    required
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder="Cole seu Google OAuth Client ID"
                    className="w-full px-3.5 py-2 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    required
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                    placeholder="Cole seu Google OAuth Client Secret"
                    className="w-full px-3.5 py-2 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Link da Pasta Raiz no Drive (Onde serão criadas as pastas dos Dentistas)
                </label>
                <input
                  type="url"
                  required
                  value={driveRootLink}
                  onChange={(e) => setDriveRootLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3.5 py-2 rounded-[10px] bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-slate-900 placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>

              {extractedFolderId && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-[11px] font-semibold text-emerald-700 space-y-1">
                  <div>✅ ID da Pasta Raiz Extraído:</div>
                  <div className="font-mono bg-white/50 p-1.5 rounded border border-emerald-200/50 text-[10px] select-all truncate">
                    {extractedFolderId}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={driveLoading}
                className="bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold px-4 py-2 rounded-lg text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {driveLoading ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </form>
          </div>
        )}

        {/* EXCEL IMPORT TAB */}
        {activeTab === 'import' && (
          <div className="space-y-4 max-w-xl animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900">Importação de Casos via Planilha Excel</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Carregue uma planilha <strong>XLSX / XLS</strong> para migrar casos passados e cadastrar dentistas automaticamente. O sistema lê as abas de meses históricos do laboratório.
            </p>

            <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-xl flex items-center justify-between gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">Selecione o arquivo Excel</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Limite de tamanho: 15MB</div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Escolher Arquivo...
              </button>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            
            {/* Notification Channels */}
            <div className="lg:col-span-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Canais de Alertas</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ative ou desative as plataformas pelas quais deseja ser notificado.
              </p>

              <div className="space-y-3">
                {/* Push */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-[#E2E8F0]">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Notificações Push (Navegador)</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {pushPermission === 'granted' 
                        ? '🟢 Permissão concedida' 
                        : pushPermission === 'denied' 
                          ? '🔴 Permissão bloqueada' 
                          : '🟡 Aguardando permissão'}
                    </p>
                  </div>
                  <input 
                    type="checkbox"
                    checked={notifSettings.enable_push}
                    onChange={(e) => handleTogglePush(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300 cursor-pointer"
                  />
                </div>

                {/* Email */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Notificações via E-mail</h4>
                      <p className="text-[9px] text-slate-400 mt-0.5">Relatórios mockados no console.</p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={notifSettings.enable_email}
                      onChange={(e) => handleToggleEmail(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300 cursor-pointer"
                    />
                  </div>
                  {notifSettings.enable_email && (
                    <div className="pt-2 border-t border-slate-200/60 animate-fade-in">
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">
                        E-mail de Destino
                      </label>
                      <input
                        type="email"
                        value={notifSettings.email_destinatario || ''}
                        onChange={(e) => {
                          const updated = { ...notifSettings, email_destinatario: e.target.value };
                          setNotifSettings(updated);
                          notificationService.saveSettings(updated);
                        }}
                        placeholder="Ex: financeiro@iorclab.com"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-xs font-semibold focus:outline-none focus:border-[#0F766E] transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Telegram */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-[#E2E8F0]">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Notificações Telegram</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5">Alertas imediatos via Telegram Bot.</p>
                  </div>
                  <input 
                    type="checkbox"
                    checked={notifSettings.enable_telegram}
                    onChange={(e) => handleToggleTelegram(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] border-slate-300 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* History Logs */}
            <div className="lg:col-span-7 space-y-4 border-t lg:border-t-0 lg:border-l border-[#E2E8F0] pt-4 lg:pt-0 lg:pl-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900">Histórico de Alertas</h3>
                {notifications.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleMarkAllRead}
                      className="px-2 py-1 bg-slate-50 border border-[#E2E8F0] text-slate-500 hover:text-[#0F766E] text-[10px] font-bold rounded-md cursor-pointer transition-all"
                    >
                      Marcar lidas
                    </button>
                    <button
                      onClick={handleClearAllNotif}
                      className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-[10px] font-bold rounded-md cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Trash2 size={10} />
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs italic">
                    Nenhuma notificação registrada ainda.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-3 rounded-lg border transition-all text-xs space-y-1 ${
                        n.is_read ? 'bg-slate-50/50 border-slate-100 text-slate-400' : 'bg-white border-[#E2E8F0] shadow-xs text-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          {getNotifCategoryBadge(n.category)}
                          <span className="font-bold text-slate-900">{n.title}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium">
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TELEGRAM CONFIG TAB */}
        {activeTab === 'telegram' && (
          <form onSubmit={handleSaveTelegramConfig} className="space-y-4 max-w-lg animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900">Configurar Bot do Telegram</h3>
            
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-800 leading-normal flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <strong>Como obter as credenciais grátis:</strong>
                <ul className="list-decimal pl-3.5 mt-1 space-y-0.5">
                  <li>Procure por <strong>@BotFather</strong> no Telegram e envie <code>/newbot</code> para criar seu bot e obter o <strong>Token</strong>.</li>
                  <li>Inicie uma conversa com seu novo bot no Telegram (clique em Começar).</li>
                  <li>Envie uma mensagem e depois consulte o bot <strong>@GetMyChatID_Bot</strong> para obter seu <strong>Chat ID</strong>.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Token do Bot
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1234567890:ABCdefGhIJKlmNoPQRsT"
                  value={notifSettings.telegram_bot_token || ''}
                  onChange={(e) => setNotifSettings({ ...notifSettings, telegram_bot_token: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs font-semibold focus:outline-none focus:border-[#0F766E] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Chat ID do Destinatário (múltiplos separados por vírgula)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 987654321, 123456789"
                  value={notifSettings.telegram_chat_id || ''}
                  onChange={(e) => setNotifSettings({ ...notifSettings, telegram_chat_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#E2E8F0] text-xs font-semibold focus:outline-none focus:border-[#0F766E] transition-all"
                />
                <span className="text-[9px] text-slate-400 block mt-1">
                  Insira um ou mais IDs de chat. O bot enviará as notificações para todos os destinatários informados.
                </span>
              </div>
            </div>

            {telegramTestStatus.message && (
              <div className={`p-2.5 rounded-lg border text-[10px] font-semibold ${
                telegramTestStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {telegramTestStatus.message}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleTestTelegram}
                className="flex-1 py-2 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-[#0F766E] text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Testar Bot
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Salvar Configuração
              </button>
            </div>
          </form>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-2">
              <div className="relative w-full md:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#64748B] pointer-events-none">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  value={logsSearch}
                  onChange={(e) => {
                    setLogsSearch(e.target.value);
                    setLogsCurrentPage(1);
                  }}
                  placeholder="Pesquisar logs por usuário, caso ou descrição..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-[#E2E8F0] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0F766E] text-[#0F172A]"
                />
              </div>
              <button
                onClick={fetchLogs}
                className="bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-sm cursor-pointer shrink-0"
              >
                Atualizar Logs
              </button>
            </div>

            {logsLoading ? (
              <div className="text-center py-12 text-[#64748B] text-xs font-medium">Carregando logs de auditoria...</div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="p-3">Data / Hora</th>
                        <th className="p-3">Usuário</th>
                        <th className="p-3">Descrição da Atividade</th>
                        <th className="p-3">ID Caso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {paginatedLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-[#64748B] text-xs italic">
                            Nenhum registro de log encontrado.
                          </td>
                        </tr>
                      ) : (
                        paginatedLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="p-3 text-slate-500 whitespace-nowrap">
                              {(() => {
                                const formatted = formatLogDate(log.created_at);
                                return (
                                  <>
                                    <span className="font-semibold text-slate-700">
                                      {formatted.date}
                                    </span>{' '}
                                    {formatted.time}
                                  </>
                                );
                              })()}
                            </td>
                            <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                              {log.user_name || 'Desconhecido'}
                            </td>
                            <td className="p-3 text-slate-700 break-words max-w-md">
                              {getLogDescription(log)}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-[#0F766E] whitespace-nowrap font-bold">
                              {log.case_id || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {logsTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#E2E8F0] gap-4 text-xs font-medium text-slate-500">
                    <div>
                      Exibindo {Math.min(filteredLogs.length, (logsCurrentPage - 1) * logsItemsPerPage + 1)} a {Math.min(filteredLogs.length, logsCurrentPage * logsItemsPerPage)} de {filteredLogs.length} logs
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={logsCurrentPage === 1}
                        onClick={() => setLogsCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer font-bold flex items-center shadow-xs"
                      >
                        <ChevronLeft size={14} /> Anterior
                      </button>
                      <span className="font-semibold text-slate-700">Página {logsCurrentPage} de {logsTotalPages}</span>
                      <button
                        type="button"
                        disabled={logsCurrentPage === logsTotalPages}
                        onClick={() => setLogsCurrentPage(prev => Math.min(logsTotalPages, prev + 1))}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-all cursor-pointer font-bold flex items-center shadow-xs"
                      >
                        Próxima <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal Estrutura do Drive */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderOpen className="text-[#0F766E]" size={18} />
                Estrutura de Pastas no Google Drive
              </h4>
              <button
                onClick={() => setShowStructureModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingStructure ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <Loader2 className="animate-spin text-[#0F766E]" size={32} />
                  <span className="text-xs text-slate-500 font-medium">Buscando pastas no Google Drive...</span>
                </div>
              ) : driveStructure ? (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Pasta Raiz</div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <FolderOpen className="text-teal-600" size={14} />
                      {driveStructure.root_folder.name}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono select-all truncate mt-1">
                      ID: {driveStructure.root_folder.id}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                      Pastas de Dentistas ({driveStructure.dentist_folders.length})
                    </div>
                    {driveStructure.dentist_folders.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-medium">
                        Nenhuma pasta de dentista encontrada sob a pasta raiz.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1 border border-slate-100 rounded-xl">
                        {driveStructure.dentist_folders.map((folder, index) => (
                          <div key={index} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-all">
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <FolderOpen className="text-amber-500 flex-shrink-0" size={16} />
                              <span className="text-xs font-semibold text-slate-700 truncate" title={folder.name}>
                                {folder.name}
                              </span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold ${
                              folder.cases_count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {folder.cases_count} {folder.cases_count === 1 ? 'caso' : 'casos'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">
                  Falha ao recuperar a estrutura do Drive.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-2xl">
              <button
                onClick={() => setShowStructureModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
