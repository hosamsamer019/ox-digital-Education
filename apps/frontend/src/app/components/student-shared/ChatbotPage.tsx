import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Plus, MessageCircle, Trash2, AlertTriangle, Loader2, CheckCircle2, X } from 'lucide-react';
import { aiApi } from '../../services/api';

export default function ChatbotPage() {
  const [messages, setMessages] = useState<any[]>([
    { id: 'welcome', text: 'مرحباً! أنا المساعد الذكي. كيف يمكنني مساعدتك اليوم؟', sender: 'bot', time: '10:00' },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);

  // Deletion state
  const [sessionToDelete, setSessionToDelete] = useState<any | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'ما هو الجبر؟',
    'كيف أحل معادلة من الدرجة الأولى؟',
    'أعطني أمثلة على المتباينات',
    'ما الفرق بين المعادلة والمتباينة؟',
  ];

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-dismiss feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const fetchSessions = async () => {
    try {
      const res = await aiApi.get('/sessions');
      setSessions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const resetToNewChat = () => {
    setSessionId(null);
    setMessages([
      {
        id: 'welcome',
        text: 'مرحباً! أنا المساعد الذكي. كيف يمكنني مساعدتك اليوم؟',
        sender: 'bot',
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const createNewSession = async () => {
    try {
      const res = await aiApi.post('/sessions');
      setSessionId(res.data.id);
      setSessions(prev => [res.data, ...prev]);
      resetToNewChat();
      setShowMobileHistory(false);
    } catch (err) {
      console.error('Failed to create session', err);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const res = await aiApi.get(`/sessions/${id}`);
      setSessionId(id);
      if (res.data?.messages && Array.isArray(res.data.messages)) {
        setMessages(res.data.messages.map((m: any) => ({
          id: m.id,
          text: m.content,
          sender: m.role === 'user' ? 'user' : 'bot',
          time: new Date(m.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        })));
      } else {
        setMessages([]);
      }
      setShowMobileHistory(false);
    } catch (err) {
      console.error('Failed to load session', err);
      setFeedback({ type: 'error', message: 'تعذر تحميل المحادثة المحددة.' });
    }
  };

  const handleDeleteSingleSession = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await aiApi.delete(`/sessions/${sessionToDelete.id}`);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));

      if (sessionId === sessionToDelete.id) {
        resetToNewChat();
      }

      setFeedback({ type: 'success', message: 'تم حذف المحادثة بنجاح.' });
      setShowDeleteModal(false);
      setSessionToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete session', err);
      const msg = err.response?.data?.message || 'حدث خطأ أثناء حذف المحادثة.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllSessions = async () => {
    setIsDeleting(true);
    try {
      await aiApi.delete('/sessions');
      setSessions([]);
      resetToNewChat();
      setFeedback({ type: 'success', message: 'تم حذف جميع المحادثات بنجاح.' });
      setShowDeleteAllModal(false);
      setShowMobileHistory(false);
    } catch (err: any) {
      console.error('Failed to delete all sessions', err);
      const msg = err.response?.data?.message || 'حدث خطأ أثناء حذف جميع المحادثات.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const res = await aiApi.post('/sessions');
        currentSessionId = res.data.id;
        setSessionId(currentSessionId);
        setSessions(prev => [res.data, ...prev]);
      } catch (err) {
        setFeedback({ type: 'error', message: 'فشل إنشاء جلسة محادثة جديدة.' });
        return;
      }
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      text: input,
      sender: 'user',
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(aiApi.defaults.baseURL + '/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: userInput
        })
      });

      if (!response.ok) {
        throw new Error(response.status === 429 ? '429' : 'Error');
      }

      setLoading(false);
      const botMessageId = `bot-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: botMessageId,
        text: '',
        sender: 'bot',
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      }]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.replace('data: ', ''));
                if (data.content) {
                  setMessages(prev => (Array.isArray(prev) ? prev : []).map(m => m.id === botMessageId ? { ...m, text: m.text + data.content } : m));
                }
                if (data.error) {
                  setMessages(prev => (Array.isArray(prev) ? prev : []).map(m => m.id === botMessageId ? { ...m, text: m.text + '\n[خطأ: ' + data.error + ']' } : m));
                }
              } catch (e) {}
            }
          }
        }
      }

      // Refresh sessions to reflect updated timestamp / preview
      fetchSessions();
    } catch (err: any) {
      setLoading(false);
      const errorMsg = err.message === '429'
        ? 'تم تجاوز الحد المسموح من الرسائل. انتظر قليلاً.'
        : 'حدث خطأ أثناء الاتصال بالمساعد الذكي.';
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        text: errorMsg,
        sender: 'bot',
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">المحادثات السابقة</h3>
        {sessions.length > 0 && (
          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="حذف جميع المحادثات"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف الكل</span>
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          لا توجد محادثات سابقة
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
          {sessions.map(s => {
            const previewText = s.messages?.[0]?.content?.substring(0, 32) || 'محادثة جديدة';
            const isCurrent = sessionId === s.id;
            return (
              <div
                key={s.id}
                className={`group flex items-center justify-between rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-600 dark:text-gray-300'
                }`}
              >
                <button
                  onClick={() => loadSession(s.id)}
                  className="flex-1 text-right p-2.5 text-sm flex items-center gap-2 min-w-0"
                  title={s.messages?.[0]?.content || previewText}
                >
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{previewText}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionToDelete(s);
                    setShowDeleteModal(true);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors opacity-80 hover:opacity-100"
                  title="حذف هذه المحادثة"
                  aria-label={`حذف محادثة: ${previewText}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-[calc(100vh-6rem)] flex flex-col relative" dir="rtl">
      {/* Toast Feedback Notification */}
      {feedback && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm transition-all animate-in fade-in slide-in-from-top-4 ${
            feedback.type === 'success'
              ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="p-0.5 hover:opacity-70 transition-opacity mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">المساعد الذكي</h1>
          <p className="text-gray-600 dark:text-gray-400">اسأل أي سؤال متعلق بالرياضيات</p>
        </div>
        <div className="flex items-center gap-2">
          {sessions.length > 0 && (
            <button
              onClick={() => setShowMobileHistory(!showMobileHistory)}
              className="md:hidden flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <MessageCircle className="w-4 h-4" />
              <span>المحادثات ({sessions.length})</span>
            </button>
          )}
          <button
            onClick={createNewSession}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>محادثة جديدة</span>
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col md:flex-row flex-1 gap-4 overflow-hidden">
        {/* Desktop Sessions Sidebar */}
        <div className="hidden md:block w-72 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-700">
          {renderSidebarContent()}
        </div>

        {/* Mobile Sessions Drawer */}
        {showMobileHistory && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/50 flex items-end">
            <div className="bg-white dark:bg-gray-800 w-full max-h-[70vh] rounded-t-2xl p-4 shadow-xl border-t border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-gray-800 dark:text-gray-200">سجل المحادثات</span>
                <button
                  onClick={() => setShowMobileHistory(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {renderSidebarContent()}
              </div>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {(Array.isArray(messages) ? messages : []).map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'bot'
                      ? 'bg-indigo-100 dark:bg-indigo-950/50'
                      : 'bg-green-100 dark:bg-green-950/50'
                  }`}
                >
                  {message.sender === 'bot' ? (
                    <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <User className="w-6 h-6 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div
                  className={`flex flex-col max-w-md ${
                    message.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.sender === 'bot'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{message.time}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-950/50">
                  <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-700">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && (
            <div className="px-6 pb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">أسئلة مقترحة:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Array.isArray(suggestedQuestions) ? suggestedQuestions : []).map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(question)}
                    className="text-right p-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-gray-800 dark:text-gray-200 transition-colors text-sm"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="اكتب سؤالك هنا..."
                disabled={loading}
                className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                title="إرسال"
              >
                <Send className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Single Session Deletion Confirmation Modal */}
      {showDeleteModal && sessionToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 text-right"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 id="delete-dialog-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              تأكيد حذف المحادثة
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              هل أنت متأكد من رغبتك في حذف هذه المحادثة؟
            </p>

            <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 text-xs text-gray-700 dark:text-gray-300 font-mono line-clamp-2">
              "{sessionToDelete.messages?.[0]?.content || 'محادثة فارغة'}"
            </div>

            <p className="text-xs text-red-500 dark:text-red-400 mb-6 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع الرسائل التابعة لها.</span>
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteSingleSession}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isDeleting ? 'جاري الحذف...' : 'حذف المحادثة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Sessions Confirmation Modal */}
      {showDeleteAllModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isDeleting && setShowDeleteAllModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 text-right"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-all-dialog-title"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 id="delete-all-dialog-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              حذف جميع المحادثات
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              هل أنت متأكد تماماً من رغبتك في حذف <strong>جميع المحادثات ({sessions.length})</strong>؟
              سيتم مسح سجل المحادثات والرسائل بالكامل ولا يمكن استرجاعها.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 mb-6">
              ملاحظة: هذا الإجراء يخص فقط محادثاتك مع المساعد الذكي ولا يمس حسابك أو درجاتك أو أي واجبات.
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteAllSessions}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isDeleting ? 'جاري الحذف...' : 'تأكيد حذف الكل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
