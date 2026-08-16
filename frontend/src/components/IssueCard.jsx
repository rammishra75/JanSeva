const STATUS_LABELS = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  verified: 'Verified',
  reopened: 'Reopened'
};

const CATEGORY_ICONS = {
  roads: '🛣️', water: '💧', sanitation: '🗑️', electricity: '⚡',
  public_safety: '🚨', environment: '🌳', health: '🏥', other: '📋'
};

export default function IssueCard({ issue, onClick }) {
  const severity = issue.severity?.computed || issue.severity?.userReported || 3;

  return (
    <div className="card issue-card" onClick={onClick}>
      <div className="issue-header">
        <div>
          <span style={{ marginRight: '0.5rem' }}>{CATEGORY_ICONS[issue.category]}</span>
          <span className="issue-title">{issue.title}</span>
        </div>
        <span className={`badge badge-${issue.status}`}>{STATUS_LABELS[issue.status] || issue.status}</span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
        {(issue.description || '').slice(0, 120)}{(issue.description?.length > 120) ? '...' : ''}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="severity-dots" title={`Severity: ${severity}/5`}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`severity-dot ${i <= severity ? 'active' : ''}`} />
          ))}
        </div>
        {issue.reportCount > 1 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
            {issue.reportCount} reports
          </span>
        )}
      </div>

      <div className="issue-meta">
        <span>{issue.category?.replace('_', ' ')}</span>
        {issue.address && <span>{issue.address}</span>}
        <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
        {issue.upvoteCount > 0 && <span>👍 {issue.upvoteCount}</span>}
      </div>
    </div>
  );
}
