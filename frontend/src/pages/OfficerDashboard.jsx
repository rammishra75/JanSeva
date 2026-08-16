import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { issueAPI } from '../services/api';
import IssueCard from '../components/IssueCard';
import RoleBadge from '../components/RoleBadge';

export default function OfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'authority') {
      navigate('/');
      return;
    }
    loadIssues();
  }, [user, filter]);

  const loadIssues = () => {
    setLoading(true);
    setError('');
    issueAPI.getIssues({ limit: 50, assignedToMe: 'true' }).then(res => {
      if (res.success) {
        let filtered = res.issues;
        if (filter === 'active') {
          filtered = filtered.filter(i => ['open', 'acknowledged', 'in_progress', 'reopened'].includes(i.status));
        } else if (filter !== 'all') {
          filtered = filtered.filter(i => i.status === filter);
        }
        setIssues(filtered);
      } else {
        setIssues([]);
        setError(res.message || 'Could not load your assigned issues.');
      }
      setLoading(false);
    });
  };

  const stats = {
    total: issues.length,
    open: issues.filter(i => i.status === 'open').length,
    inProgress: issues.filter(i => i.status === 'in_progress').length,
    breached: issues.filter(i => i.slaDeadline && new Date(i.slaDeadline) < new Date() && !['resolved', 'verified'].includes(i.status)).length
  };

  return (
    <div className="page officer-page">
      <div className="container">
        <div className="page-header officer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h1>Officer Workbench</h1>
              <RoleBadge role={user?.role} />
            </div>
            <p>
              {user?.role === 'admin'
                ? 'Full system oversight — manage all departments and escalations'
                : 'Issues assigned to your department — update status and resolve complaints'}
            </p>
          </div>
          {user?.role === 'admin' && (
            <Link to="/dashboard" className="btn btn-outline">Analytics Dashboard →</Link>
          )}
        </div>

        <div className="stats-grid officer-stats">
          <div className="stat-card stat-open">
            <div className="stat-icon">📋</div>
            <div className="value">{stats.open}</div>
            <div className="label">Awaiting Action</div>
          </div>
          <div className="stat-card stat-progress">
            <div className="stat-icon">🔧</div>
            <div className="value">{stats.inProgress}</div>
            <div className="label">In Progress</div>
          </div>
          <div className="stat-card stat-breach">
            <div className="stat-icon">⚠️</div>
            <div className="value">{stats.breached}</div>
            <div className="label">SLA Breached</div>
          </div>
          <div className="stat-card stat-total">
            <div className="stat-icon">📊</div>
            <div className="value">{stats.total}</div>
            <div className="label">Assigned Total</div>
          </div>
        </div>

        <div className="filters">
          {['all', 'active', 'in_progress', 'resolved'].map(f => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">Loading assigned issues...</div>
        ) : issues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>No issues in this queue</h3>
            <p>All assigned issues are handled. Great work!</p>
          </div>
        ) : (
          <div className="card-grid">
            {issues.map(issue => (
              <IssueCard key={issue._id} issue={issue} onClick={() => navigate(`/issues/${issue._id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
