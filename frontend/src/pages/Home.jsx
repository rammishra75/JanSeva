import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { issueAPI } from '../services/api';
import IssueCard from '../components/IssueCard';
import IssueMap from '../components/IssueMap';
import RoleBadge from '../components/RoleBadge';

export default function Home() {
  const { t, user } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState({ total: 0, resolved: 0, open: 0 });

  useEffect(() => {
    issueAPI.getIssues({ limit: 6 }).then(res => {
      if (res.success) {
        setIssues(res.issues);
        setStats({
          total: res.total,
          open: res.issues.filter(i => ['open', 'in_progress', 'acknowledged'].includes(i.status)).length,
          resolved: res.issues.filter(i => ['resolved', 'verified'].includes(i.status)).length
        });
      }
    });
  }, []);

  const roleHero = {
    citizen: {
      badge: '👤 Citizen Portal',
      title: 'Your Voice Matters',
      subtitle: 'Report civic issues, track resolution, and verify fixes in your community.',
      primary: { to: '/report', label: 'Report an Issue' },
      secondary: { to: '/issues', label: 'Browse Issues' }
    },
    authority: {
      badge: '🏛️ Officer Portal',
      title: 'Officer Workbench',
      subtitle: 'Manage assigned complaints, update status, and resolve citizen issues with full accountability.',
      primary: { to: '/officer', label: 'Open Workbench' },
      secondary: { to: '/issues', label: 'All Issues' }
    },
    admin: {
      badge: '⚙️ Admin Command Center',
      title: 'System Administration',
      subtitle: 'Full oversight — analytics, SLA monitoring, department bottlenecks, and data export.',
      primary: { to: '/dashboard', label: 'Analytics Dashboard' },
      secondary: { to: '/officer', label: 'Issue Workbench' }
    }
  };

  const hero = user ? roleHero[user.role] || roleHero.citizen : {
    badge: '🏛️ Civic Platform',
    title: 'JanSeva',
    subtitle: t('welcome'),
    primary: { to: '/register', label: 'Get Started' },
    secondary: { to: '/issues', label: 'Browse Issues' }
  };

  return (
    <>
      <section className="hero">
        <div className="container">
          {user && <div className="hero-badge">{hero.badge}</div>}
          {!user && <div className="hero-badge">🏛️ Civic Issue Management Platform</div>}
          <h1>{hero.title}</h1>
          <p>{hero.subtitle}</p>
          {user && <div style={{ marginBottom: '1.5rem' }}><RoleBadge role={user.role} /></div>}
          <div className="hero-actions">
            <Link to={hero.primary.to} className="btn btn-primary">{hero.primary.label}</Link>
            <Link to={hero.secondary.to} className="btn btn-outline">{hero.secondary.label}</Link>
          </div>
        </div>
      </section>

      <section className="container" style={{ marginTop: '-3rem', position: 'relative', zIndex: 1 }}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="value">{stats.total || '—'}</div>
            <div className="label">Total Issues</div>
          </div>
          <div className="stat-card stat-open">
            <div className="value">{stats.open || '—'}</div>
            <div className="label">Active</div>
          </div>
          <div className="stat-card stat-progress">
            <div className="value">{stats.resolved || '—'}</div>
            <div className="label">Resolved</div>
          </div>
          <div className="stat-card stat-total">
            <div className="value">AI</div>
            <div className="label">Smart Dedup</div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="container">
          <div className="page-header">
            <h1>Live Issue Map</h1>
            <p>Geo-tagged civic issues across your city</p>
          </div>
          <IssueMap issues={issues} className="large" />
        </div>
      </section>

      <section className="page" style={{ background: 'white' }}>
        <div className="container">
          <div className="page-header">
            <h1>Recent Issues</h1>
            <p>Community-reported with crowd-validated severity</p>
          </div>
          <div className="card-grid">
            {issues.map(issue => (
              <Link key={issue._id} to={`/issues/${issue._id}`} style={{ textDecoration: 'none' }}>
                <IssueCard issue={issue} />
              </Link>
            ))}
          </div>
          {issues.length === 0 && <div className="loading">No issues yet — be the first to report!</div>}
        </div>
      </section>

      {!user && (
        <section className="page">
          <div className="container">
            <div className="card" style={{ textAlign: 'center' }}>
              <h2 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Why JanSeva?</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Built for real civic accountability</p>
              <div className="feature-grid">
                {[
                  { icon: '🧠', title: 'Smart Deduplication', desc: 'Merges duplicate reports automatically' },
                  { icon: '📊', title: 'Crowd Severity', desc: 'Community-validated priority scoring' },
                  { icon: '🏛️', title: 'SLA Routing', desc: 'Auto-routes to correct department' },
                  { icon: '🔍', title: 'Public Lifecycle', desc: 'Full transparency from report to verify' }
                ].map(f => (
                  <div key={f.title} className="feature-item">
                    <div className="icon">{f.icon}</div>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
