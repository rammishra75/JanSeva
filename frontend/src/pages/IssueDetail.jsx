import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { issueAPI } from '../services/api';
import LifecycleTimeline from '../components/LifecycleTimeline';
import IssueMap from '../components/IssueMap';
import AuthorityPanel from '../components/AuthorityPanel';

export default function IssueDetail() {
  const { id } = useParams();
  const { user, t } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [verifyComment, setVerifyComment] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => issueAPI.getIssue(id).then(res => {
    if (res.success) setData(res);
    else navigate('/issues');
  });

  useEffect(() => { load(); }, [id]);

  const handleVote = async (vote) => {
    if (!user) return navigate('/login');
    const res = await issueAPI.vote(id, vote);
    if (res.success) load();
    else setError(res.message);
  };

  const handleVerify = async (resolved) => {
    if (!user) return navigate('/login');
    const res = await issueAPI.verify(id, resolved, verifyComment);
    if (res.success) {
      setMessage(resolved ? 'Thank you — marked as properly resolved' : 'Issue flagged — will be reopened for review');
      setError('');
      load();
    } else setError(res.message);
  };

  if (!data) return <div className="loading"><div className="spinner" /> Loading issue...</div>;

  const { issue, clusterInfo, lifecycleDurations } = data;
  const severity = issue.severity?.computed || issue.severity?.userReported || 3;
  const isOfficer = user?.role === 'authority';

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 960 }}>
        {clusterInfo && (
          <div className="duplicate-alert">
            <span className="alert-icon">🔗</span>
            <div>
              <strong>{t('alreadyReported')} {clusterInfo.reportCount} {t('users')}</strong>
              <p>This report was merged with an existing issue cluster.</p>
            </div>
          </div>
        )}

        <div className="issue-detail-header card">
          <div className="issue-detail-top">
            <div>
              <div className="issue-category-tag">{issue.category?.replace('_', ' ')}</div>
              <h1>{issue.title}</h1>
              <span className={`badge badge-${issue.status}`}>{issue.status?.replace('_', ' ')}</span>
            </div>
            <div className="severity-block">
              <span className="severity-label">Severity</span>
              <div className="severity-dots">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`severity-dot ${i <= severity ? 'active' : ''}`} />
                ))}
              </div>
              <span className="severity-value">{severity}/5</span>
            </div>
          </div>

          <p className="issue-description">{issue.description}</p>

          <div className="issue-meta-grid">
            <div className="meta-item"><span className="meta-label">Reports</span><span>{issue.reportCount}</span></div>
            <div className="meta-item"><span className="meta-label">Created</span><span>{new Date(issue.createdAt).toLocaleString()}</span></div>
            {issue.subtype && <div className="meta-item"><span className="meta-label">Type</span><span>{issue.subtype.replace('_', ' ')}</span></div>}
            {issue.slaDeadline && (
              <div className="meta-item">
                <span className="meta-label">SLA</span>
                <span className={new Date(issue.slaDeadline) < new Date() ? 'text-danger' : ''}>
                  {new Date(issue.slaDeadline).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {issue.primaryAuthority && (
            <div className="assigned-dept">
              <span className="dept-icon">🏛️</span>
              <div>
                <strong>{issue.primaryAuthority.name}</strong>
                <span>{issue.primaryAuthority.department}</span>
              </div>
            </div>
          )}
        </div>

        {isOfficer && issue.status !== 'verified' && (
          <AuthorityPanel issue={issue} user={user} onUpdate={load} />
        )}

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title">Public Lifecycle</h3>
          <LifecycleTimeline lifecycle={issue.lifecycle} durations={lifecycleDurations} currentStatus={issue.status} />
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 className="section-title">Location</h3>
          <IssueMap issues={[issue]} center={[issue.location.coordinates[1], issue.location.coordinates[0]]} zoom={15} />
        </div>

        {user?.role === 'citizen' && (
          <div className="vote-bar card" style={{ marginTop: '1.5rem' }}>
            <span className="vote-label">Community Severity Vote</span>
            <button className="vote-btn" onClick={() => handleVote('up')}>👍 {issue.upvoteCount || 0}</button>
            <button className="vote-btn" onClick={() => handleVote('down')}>👎 {issue.downvoteCount || 0}</button>
            <span className="computed-severity">Score: {severity}/5</span>
          </div>
        )}

        {issue.status === 'resolved' && user?.role === 'citizen' && (
          <div className="card verify-panel" style={{ marginTop: '1.5rem' }}>
            <h3>{t('verify')}</h3>
            <p>Has this issue been properly resolved? Your vote holds authorities accountable.</p>
            {issue.resolutionNote && <div className="alert alert-info">Officer note: {issue.resolutionNote}</div>}
            <textarea className="form-control" placeholder="Optional comment..." value={verifyComment}
              onChange={e => setVerifyComment(e.target.value)} />
            <div className="verify-actions">
              <button className="btn btn-secondary" onClick={() => handleVerify(true)}>✓ Yes, Resolved</button>
              <button className="btn btn-danger" onClick={() => handleVerify(false)}>✗ Not Resolved</button>
            </div>
            {issue.verificationVotes?.length > 0 && (
              <p className="verify-count">
                {issue.verificationVotes.filter(v => v.resolved).length} confirmed,
                {issue.verificationVotes.filter(v => !v.resolved).length} rejected
              </p>
            )}
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>}
        {message && <div className="alert alert-success" style={{ marginTop: '1rem' }}>{message}</div>}
      </div>
    </div>
  );
}
