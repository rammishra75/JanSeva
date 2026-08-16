import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { issueAPI } from '../services/api';
import IssueCard from '../components/IssueCard';
import IssueMap from '../components/IssueMap';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '' });
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const params = { limit: 50 };
    if (filters.status) params.status = filters.status;
    if (filters.category) params.category = filters.category;

    issueAPI.getIssues(params).then(res => {
      if (res.success) setIssues(res.issues);
      setLoading(false);
    });
  }, [filters]);

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Civic Issues</h1>
          <p>Browse, vote, and track community-reported issues</p>
        </div>

        <div className="filters">
          <select className="form-control" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="verified">Verified</option>
          </select>
          <select className="form-control" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            <option value="roads">Roads</option>
            <option value="water">Water</option>
            <option value="sanitation">Sanitation</option>
            <option value="electricity">Electricity</option>
            <option value="public_safety">Public Safety</option>
            <option value="environment">Environment</option>
            <option value="health">Health</option>
          </select>
        </div>

        <IssueMap issues={issues} className="large" />

        <div className="card-grid" style={{ marginTop: '2rem' }}>
          {issues.map(issue => (
            <IssueCard key={issue._id} issue={issue} onClick={() => navigate(`/issues/${issue._id}`)} />
          ))}
        </div>

        {loading && <div className="loading">Loading issues...</div>}
        {!loading && issues.length === 0 && <div className="loading">No issues found</div>}
      </div>
    </div>
  );
}
