import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleBadge from '../components/RoleBadge';

const DEMO_ACCOUNTS = [
  { email: 'citizen@example.com', password: 'password123', role: 'citizen', name: 'Rajesh Kumar', desc: 'Report & verify issues' },
  { email: 'officer@janseva.gov', password: 'password123', role: 'authority', name: 'Municipal Officer', desc: 'Manage & resolve complaints' },
  { email: 'admin@janseva.gov', password: 'password123', role: 'admin', name: 'Admin User', desc: 'Full system analytics' }
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await login(form.email, form.password);
    setLoading(false);
    if (res.success) {
      if (res.user.role === 'authority') navigate('/officer');
      else if (res.user.role === 'admin') navigate('/dashboard');
      else navigate('/');
    } else {
      setError(res.message || 'Login failed');
    }
  };

  const quickLogin = async (account) => {
    setForm({ email: account.email, password: account.password });
    setLoading(true);
    setError('');
    const res = await login(account.email, account.password);
    setLoading(false);
    if (res.success) {
      if (account.role === 'authority') navigate('/officer');
      else if (account.role === 'admin') navigate('/dashboard');
      else navigate('/');
    } else setError(res.message);
  };

  return (
    <div className="page">
      <div className="auth-container card">
        <h2>Welcome Back</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Sign in to your JanSeva account
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" required value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem' }}>
          New here? <Link to="/register">Create citizen account</Link>
        </p>

        <div className="demo-accounts">
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Demo Login
          </p>
          {DEMO_ACCOUNTS.map(acc => (
            <div key={acc.email} className="demo-account" onClick={() => quickLogin(acc)}>
              <div className="demo-account-info">
                <strong>{acc.name}</strong>
                <span>{acc.desc}</span>
              </div>
              <RoleBadge role={acc.role} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
