import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { notificationService, Notification } from '../../services/notification.service';
import { LoadingState } from '../ui/LoadingState';

export const ParentNotificationsPage: React.FC = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const fetchNotifications = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await notificationService.getNotifications({ limit: 50 });
      const list = Array.isArray(res.data) ? res.data : [];
      setNotifications(list);
    } catch (err: any) {
      console.error('Failed to fetch parent notifications:', err);
      setError(t('تعذر تحميل التنبيهات والإشعارات. يرجى التحقق من اتصال الشبكة.'));
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      window.dispatchEvent(new Event('ox:counters-refresh'));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      window.dispatchEvent(new Event('ox:counters-refresh'));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    filter === 'unread' ? !n.read : true
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return <LoadingState message={t('جاري تحميل سجل التنبيهات والإشعارات...')} />;
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              <Bell className="w-3.5 h-3.5" />
              {t('سجل التنبيهات المدرسية')}
            </span>
            {unreadCount > 0 && (
              <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {unreadCount} {t('غير مقروء')}
              </span>
            )}
          </div>
          <h1 className={`text-2xl font-extrabold ${textPrimary}`}>{t('التنبيهات والإشعارات')}</h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {t('متابعة الإشعارات الرسمية وتنبيهات أداء الأبناء الواردة من إدارة المنظومة والمعلمين')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{t('تحديد الكل كمقروء')}</span>
            </button>
          )}

          <button
            onClick={() => fetchNotifications(true)}
            disabled={refreshing}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
            <span>{t('تحديث')}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchNotifications(true)}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-[#9e1b1b] text-white shadow-xs'
              : isDark
              ? 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('كافة التنبيهات (')}{notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'unread'
              ? 'bg-[#9e1b1b] text-white shadow-xs'
              : isDark
              ? 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('غير المقروءة (')}{unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className={`${cardBg} border rounded-2xl p-10 text-center`}>
            <Bell className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-40" />
            <p className={`font-semibold ${textPrimary}`}>{t('لا توجد إشعارات مطابقة')}</p>
            <p className={`text-xs ${textSecondary} mt-1`}>
              {filter === 'unread'
                ? 'لقد قمت بقراءة جميع الإشعارات الواردة.'
                : 'سجل التنبيهات والإشعارات فارغ حالياً.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const isUnread = !n.read;
            const notifDate = n.createdAt ? new Date(n.createdAt) : null;
            const formattedDate =
              notifDate && !isNaN(notifDate.getTime())
                ? `${notifDate.toLocaleDateString('ar-EG')} - ${notifDate.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'مؤخراً';

            return (
              <div
                key={n.id}
                className={`${cardBg} border rounded-2xl p-4 sm:p-5 transition-all ${
                  isUnread
                    ? isDark
                      ? 'border-[#9e1b1b]/40 bg-[#161c28]'
                      : 'border-[#9e1b1b]/30 bg-red-50/30'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                        isUnread ? 'bg-[#9e1b1b]' : 'bg-slate-400/40'
                      }`}
                    />
                    <div className="flex-1">
                      {n.title && (
                        <h3 className={`text-sm font-bold ${textPrimary} mb-1`}>{n.title}</h3>
                      )}
                      <p className={`text-xs sm:text-sm ${textSecondary} leading-relaxed`}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      className="text-xs font-semibold text-[#9e1b1b] hover:underline flex-shrink-0 cursor-pointer pt-1"
                    >
                      {t('تحديد كمقروء')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ParentNotificationsPage;
