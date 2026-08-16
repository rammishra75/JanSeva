import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const translations = {
  en: {
    home: 'Home', report: 'Report Issue', issues: 'Issues', dashboard: 'Dashboard',
    login: 'Login', logout: 'Logout', register: 'Register',
    title: 'Title', description: 'Description', category: 'Category',
    severity: 'Severity', submit: 'Submit Report', search: 'Search issues...',
    resolved: 'Resolved', open: 'Open', inProgress: 'In Progress',
    verify: 'Verify Resolution', upvote: 'Upvote', downvote: 'Downvote',
    alreadyReported: 'Already reported by', users: 'users',
    anonymous: 'Report Anonymously', offline: 'Offline Mode',
    welcome: 'Report civic issues. Track resolution. Hold authorities accountable.'
  },
  hi: {
    home: 'होम', report: 'समस्या दर्ज करें', issues: 'समस्याएं', dashboard: 'डैशबोर्ड',
    login: 'लॉगिन', logout: 'लॉगआउट', register: 'पंजीकरण',
    title: 'शीर्षक', description: 'विवरण', category: 'श्रेणी',
    severity: 'गंभीरता', submit: 'रिपोर्ट जमा करें', search: 'समस्याएं खोजें...',
    resolved: 'हल हो गया', open: 'खुला', inProgress: 'प्रगति में',
    verify: 'समाधान सत्यापित करें', upvote: 'सहमत', downvote: 'असहमत',
    alreadyReported: 'पहले से रिपोर्ट किया गया', users: 'उपयोगकर्ताओं द्वारा',
    anonymous: 'गुमनाम रिपोर्ट', offline: 'ऑफलाइन मोड',
    welcome: 'नागरिक समस्याएं दर्ज करें। समाधान ट्रैक करें। अधिकारियों को जवाबदेह बनाएं।'
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(localStorage.getItem('lang') || 'en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(
    JSON.parse(localStorage.getItem('offlineQueue') || '[]')
  );

  const t = (key) => translations[language]?.[key] || translations.en[key] || key;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe().then(res => {
        if (res.success) setUser(res.user);
        else localStorage.removeItem('token');
      }).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineQueue]);

  const syncOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (queue.length === 0) return;
    const { issueAPI } = await import('../services/api');
    const res = await issueAPI.syncOffline(queue);
    if (res.success) {
      localStorage.setItem('offlineQueue', '[]');
      setOfflineQueue([]);
    }
  };

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    if (res.success) {
      localStorage.setItem('token', res.token);
      setUser(res.user);
    }
    return res;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    if (res.success) {
      localStorage.setItem('token', res.token);
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  const queueOfflineIssue = (issue) => {
    const queue = [...offlineQueue, { ...issue, offlineId: Date.now() }];
    setOfflineQueue(queue);
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, language, changeLanguage, t,
      isOnline, offlineQueue, queueOfflineIssue
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
