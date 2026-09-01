import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertCircle, Info, X, Trash2, Check, Clock } from 'lucide-react';
import { AppNotification, User } from '../types';
import { useTranslation } from '../utils/translations';

interface NotificationsModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onRefreshBadge?: () => void;
  lang?: 'en' | 'hi';
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onRefreshBadge,
  lang = 'en'
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useTranslation(lang);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}&role=${currentUser.role}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, currentUser.id]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      if (onRefreshBadge) onRefreshBadge();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    try {
      await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, role: currentUser.role })
      });
      setNotifications([]);
      if (onRefreshBadge) onRefreshBadge();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('notifications')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {notifications.filter(n => !n.is_read).length} {t('unread_notifications')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <button
                id="clear-all-notifs-btn"
                onClick={handleClearAll}
                className="text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                title={t('clear_all')}
              >
                <Trash2 className="w-3 h-3" />
                <span>{t('clear_all')}</span>
              </button>
            )}
            <button
              id="close-notifs-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span>Loading notifications...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto mb-2 text-slate-400">
                <Bell className="w-6 h-6 stroke-1" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('no_notifications')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">You're all caught up with attendance and leave updates</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isSuccess = notif.type === 'success';
              const isError = notif.type === 'error';
              const isWarning = notif.type === 'warning';

              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    !notif.is_read
                      ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/80 shadow-xs'
                      : 'bg-white dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                      isSuccess
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : isError
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                        : isWarning
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                    }`}>
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isError ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : isWarning ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                          {notif.title}
                        </h4>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : 'Just now'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] text-slate-400">
            Real-time status updates for attendance and leave approvals
          </p>
        </div>

      </div>
    </div>
  );
};
