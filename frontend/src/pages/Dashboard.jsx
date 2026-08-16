import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, issueAPI } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const STATUS_LABELS = {
  open: 'Open', acknowledged: 'Acknowledged', in_progress: 'In Progress',
  resolved: 'Resolved', verified: 'Verified', reopened: 'Reopened'
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    analyticsAPI.getDashboard().then(res => {
      if (res.success) setData(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'authority')) {
      navigate('/');
      return;
    }
    load();
  }, [user]);

  const deleteReports = async (scope) => {
    const isAll = scope === 'all';
    const message = isAll
      ? 'Delete every report permanently? This cannot be undone.'
      : 'Delete all resolved and verified reports permanently? This cannot be undone.';

    if (!window.confirm(message)) return;

    setDeleting(scope);
    const response = isAll ? await issueAPI.deleteAll() : await issueAPI.deleteResolved();
    setDeleting(null);

    if (response.success) {
      window.alert(response.message);
      load();
    } else {
      window.alert(response.message || 'Could not delete reports.');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" />Loading live analytics...</div>;
  if (!data) return <div className="loading">Failed to load dashboard. Is the backend running?</div>;

  const { stats, bottlenecks, insights, categories, statuses, timeline, recentIssues, userStats } = data;

  const statusData = (statuses || []).map(s => ({
    name: STATUS_LABELS[s._id] || s._id,
    value: s.count
  })).filter(s => s.value > 0);

  const categoryData = (categories || []).map(c => ({
    name: c._id.replace('_', ' '),
    count: c.count
  }));

  const hasData = stats.total > 0 || stats.totalReports > 0;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Live Analytics Dashboard</h1>
            <p>Real-time data from your JanSeva database — updates on every report</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
        </div>

        {user?.role === 'admin' && (
          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--danger)' }}>
            <h3 className="section-title">Report Cleanup</h3>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              These permanent actions are available only to administrators. A confirmation is required before deletion.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => deleteReports('resolved')} disabled={Boolean(deleting)}>
                {deleting === 'resolved' ? 'Deleting...' : 'Delete Resolved Reports'}
              </button>
              <button className="btn btn-danger" onClick={() => deleteReports('all')} disabled={Boolean(deleting)}>
                {deleting === 'all' ? 'Deleting...' : 'Delete All Reports'}
              </button>
            </div>
          </div>
        )}

        {!hasData && (
          <div className="alert alert-info">
            No issues registered yet. Data will appear here as citizens report issues on the platform.
          </div>
        )}

        {/* Live stats from DB */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="value">{stats.total}</div>
            <div className="label">Unique Issues</div>
          </div>
          <div className="stat-card stat-open">
            <div className="value">{stats.active}</div>
            <div className="label">Active</div>
          </div>
          <div className="stat-card stat-progress">
            <div className="value">{stats.resolved + stats.verified}</div>
            <div className="label">Resolved / Verified</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.duplicateReportsMerged}</div>
            <div className="label">Duplicates Blocked</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.dedupRate}%</div>
            <div className="label">Dedup Rate</div>
          </div>
          <div className="stat-card">
            <div className="value">{userStats?.totalUsers || 0}</div>
            <div className="label">Registered Users</div>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Status pie — all real statuses */}
          <div className="card chart-card">
            <h3 className="section-title">Issues by Status</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>No status data yet</p>
            )}
          </div>

          {/* Live insights from DB only */}
          <div className="card">
            <h3 className="section-title">Live Insights</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Generated from actual registered data
            </p>
            {insights?.length > 0 ? insights.map((insight, i) => (
              <div key={i} className={`insight-card ${insight.type === 'bottleneck' ? 'danger' : insight.type === 'chronic_zone' ? 'warning' : ''}`}>
                <strong>{insight.type.replace('_', ' ').toUpperCase()}</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{insight.message}</p>
              </div>
            )) : (
              <p className="text-muted">Report some issues to generate insights</p>
            )}

            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg)', borderRadius: 8 }}>
              <strong style={{ fontSize: '0.85rem' }}>Platform Users</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span>👤 Citizens: {userStats?.citizens || 0}</span>
                <span>🏛️ Officers: {userStats?.officers || 0}</span>
                <span>⚙️ Admins: {userStats?.admins || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category breakdown — real data */}
        {categoryData.length > 0 && (
          <div className="card chart-card" style={{ marginTop: '1.5rem' }}>
            <h3 className="section-title">Issues by Category</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Reports over time — real timeline */}
        {timeline?.length > 0 && (
          <div className="card chart-card" style={{ marginTop: '1.5rem' }}>
            <h3 className="section-title">Reports Over Last 30 Days</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="newReports" stroke="#2563eb" strokeWidth={2} name="New Issues" dot />
                <Line type="monotone" dataKey="duplicatesBlocked" stroke="#dc2626" strokeWidth={2} name="Duplicates Blocked" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent issues table — real records */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title">Recently Registered Issues</h3>
          {recentIssues?.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Title</th>
                    <th style={{ padding: '0.75rem' }}>Category</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Reports</th>
                    <th style={{ padding: '0.75rem' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIssues.map(issue => (
                    <tr key={issue._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <Link to={`/issues/${issue._id}`}>{issue.title}</Link>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{issue.category?.replace('_', ' ')}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge badge-${issue.status}`}>{issue.status?.replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{issue.reportCount || 1}</td>
                      <td style={{ padding: '0.75rem' }}>{new Date(issue.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No issues registered yet</p>
          )}
        </div>

        {/* Department bottlenecks — real */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title">Department Workload</h3>
          {bottlenecks?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Department</th>
                  <th style={{ padding: '0.75rem' }}>Open</th>
                  <th style={{ padding: '0.75rem' }}>Avg Age (days)</th>
                  <th style={{ padding: '0.75rem' }}>SLA Breaches</th>
                </tr>
              </thead>
              <tbody>
                {bottlenecks.map((b, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>{b.name}</td>
                    <td style={{ padding: '0.75rem' }}>{b.openCount}</td>
                    <td style={{ padding: '0.75rem' }}>{b.avgAgeDays?.toFixed(1) || '—'}</td>
                    <td style={{ padding: '0.75rem', color: b.breachedSLA > 0 ? 'var(--danger)' : 'inherit', fontWeight: b.breachedSLA > 0 ? 700 : 400 }}>
                      {b.breachedSLA}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">No department data — issues will appear here once routed to authorities</p>
          )}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <a href="/api/analytics/export?format=json" className="btn btn-outline" target="_blank" rel="noreferrer">Export JSON</a>
          <a href="/api/analytics/export?format=csv" className="btn btn-outline" download>Export CSV</a>
        </div>
      </div>
    </div>
  );
}
