import type { AppNotification, NotificationSettings } from '../types';

const STORAGE_KEYS = {
  NOTIFICATIONS: 'matheus_protese_notifications',
  SETTINGS: 'matheus_protese_notification_settings'
};

export const notificationService = {
  getSettings(): NotificationSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        // use default
      }
    }
    return {
      enable_push: true,
      enable_email: false,
      email_destinatario: '',
      enable_telegram: false,
      telegram_bot_token: '',
      telegram_chat_id: ''
    };
  },

  saveSettings(settings: NotificationSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  list(): AppNotification[] {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        // ignore
      }
    }
    return [];
  },

  add(title: string, message: string, category: AppNotification['category'], caseId?: string) {
    const list = this.list();
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      message,
      category,
      case_id: caseId,
      is_read: false,
      created_at: new Date().toISOString()
    };
    
    // Manter as últimas 100 notificações
    list.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list.slice(0, 100)));

    const settings = this.getSettings();

    // 1. Notificação Push Local
    if (settings.enable_push && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.svg'
        });
      } catch (err) {
        console.error('Erro ao exibir notificação push nativa:', err);
      }
    }

    // 2. Notificação via Telegram Bot API (apenas para ações de dentistas)
    const currentUserStr = localStorage.getItem('matheus_protese_current_user');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    const isDentist = currentUser?.role === 'dentist';

    if (isDentist && settings.enable_telegram && settings.telegram_bot_token && settings.telegram_chat_id) {
      const text = `🔔 *${title}*\n\n${message}${caseId ? `\n\nCaso ID: \`${caseId}\`` : ''}`;
      const url = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
      
      const chatIds = settings.telegram_chat_id
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      chatIds.forEach(chatId => {
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown'
          })
        })
        .then(res => {
          if (!res.ok) {
            console.error(`Falha ao enviar notificação para o Telegram chat_id ${chatId}: ${res.status}`);
          }
        })
        .catch(err => {
          console.error(`Erro na requisição para a API do Telegram chat_id ${chatId}:`, err);
        });
      });
    }

    // 3. Notificação via E-mail (Simulado)
    if (settings.enable_email) {
      const targetEmail = settings.email_destinatario || 'dr.matheus@iorclab.com';
      console.log(`%c[MOCK EMAIL SENT TO ${targetEmail}] %c${title}: ${message}`, "color: #0F766E; font-weight: bold", "color: inherit");
    }

    // Disparar evento de janela para re-renderização em tempo real do badge de sino
    window.dispatchEvent(new Event('new_notification_received'));
    return newNotif;
  },

  markAsRead(id: string) {
    const list = this.list();
    const found = list.find(n => n.id === id);
    if (found) {
      found.is_read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
      window.dispatchEvent(new Event('new_notification_received'));
    }
  },

  markAllAsRead() {
    const list = this.list().map(n => ({ ...n, is_read: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    window.dispatchEvent(new Event('new_notification_received'));
  },

  clearAll() {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    window.dispatchEvent(new Event('new_notification_received'));
  }
};
