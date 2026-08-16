import { useState } from 'react';
import { issueAPI } from '../services/api';
import RoleBadge from './RoleBadge';

export default function AuthorityPanel({ issue, user, onUpdate }) {
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionFiles, setResolutionFiles] = useState([]);

  const updateStatus = async (status, extra = {}) => {
    setLoading(status);
    setError('');
    setSuccess('');

    let res;
    if (status === 'resolved' && resolutionFiles.length > 0) {
      const formData = new FormData();
      formData.append('status', status);
      formData.append('resolutionNote', extra.resolutionNote || resolutionNote);
      formData.append('department', user.role === 'admin' ? 'Admin' : 'Municipal');
      resolutionFiles.forEach(f => formData.append('resolutionProof', f));
      res = await issueAPI.updateStatus(issue._id, formData);
    } else {
      res = await issueAPI.updateStatusJson(issue._id, {
        status,
        note: extra.note || `${status.replace('_', ' ')} by ${user.name}`,
        department: user.role === 'admin' ? 'Administration' : 'Municipal Corporation',
        resolutionNote: extra.resolutionNote || resolutionNote
      });
    }

    setLoading('');
    if (res.success) {
      setSuccess(`Issue marked as ${status.replace('_', ' ')}`);
      setShowResolveModal(false);
      setResolutionNote('');
      setResolutionFiles([]);
      onUpdate?.();
    } else {
      setError(res.message || 'Failed to update status');
    }
  };

  const actions = [];

  if (issue.status === 'open') {
    actions.push({ status: 'acknowledged', label: 'Acknowledge', icon: '✓', variant: 'primary' });
  }
  if (['open', 'acknowledged', 'reopened'].includes(issue.status)) {
    actions.push({ status: 'in_progress', label: 'Start Work', icon: '🔧', variant: 'primary' });
  }
  if (['in_progress', 'acknowledged'].includes(issue.status)) {
    actions.push({ status: 'resolved', label: 'Mark Resolved', icon: '✅', variant: 'success', modal: true });
  }

  const slaBreached = issue.slaDeadline && new Date(issue.slaDeadline) < new Date();

  return (
    <div className="authority-panel">
      <div className="authority-panel-header">
        <div>
          <h3>Officer Control Panel</h3>
          <p>Manage issue workflow and update public status</p>
        </div>
        <RoleBadge role={user.role} />
      </div>

      {slaBreached && issue.status !== 'resolved' && issue.status !== 'verified' && (
        <div className="alert alert-error">
          ⚠ SLA deadline breached — this issue requires immediate action
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="authority-status-grid">
        <div className="authority-stat">
          <span className="label">Current Status</span>
          <span className={`badge badge-${issue.status}`}>{issue.status.replace('_', ' ')}</span>
        </div>
        <div className="authority-stat">
          <span className="label">Reports</span>
          <span className="value">{issue.reportCount}</span>
        </div>
        {issue.slaDeadline && (
          <div className="authority-stat">
            <span className="label">SLA Deadline</span>
            <span className={`value ${slaBreached ? 'text-danger' : ''}`}>
              {new Date(issue.slaDeadline).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {actions.length > 0 ? (
        <div className="authority-actions">
          {actions.map(action => (
            <button
              key={action.status}
              className={`btn btn-${action.variant} authority-action-btn`}
              disabled={!!loading}
              onClick={() => action.modal ? setShowResolveModal(true) : updateStatus(action.status)}
            >
              <span className="action-icon">{action.icon}</span>
              {loading === action.status ? 'Updating...' : action.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted">No actions available for current status.</p>
      )}

      {showResolveModal && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Mark as Resolved</h3>
            <p className="text-muted">Provide resolution details visible to citizens for verification.</p>
            <div className="form-group">
              <label>Resolution Note *</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Describe what was fixed, when, and by which team..."
                value={resolutionNote}
                onChange={e => setResolutionNote(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Proof Photo (optional)</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={e => setResolutionFiles([...e.target.files])}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowResolveModal(false)}>Cancel</button>
              <button
                className="btn btn-secondary"
                disabled={!resolutionNote.trim() || loading === 'resolved'}
                onClick={() => updateStatus('resolved', { resolutionNote })}
              >
                {loading === 'resolved' ? 'Submitting...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
