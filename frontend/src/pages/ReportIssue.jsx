import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { issueAPI } from '../services/api';
import IssueMap from '../components/IssueMap';

export default function ReportIssue() {
  const { user, t, isOnline, queueOfflineIssue } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState({});
  const [form, setForm] = useState({
    title: '', description: '', category: '', subtype: '',
    severity: 3, urgency: 3, isAnonymous: false, address: ''
  });
  const [location, setLocation] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) navigate('/login');
    issueAPI.getCategories().then(res => {
      if (res.success) setCategories(res.categories);
    });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {
        setLocation({ lat: 28.6139, lng: 77.2090 });
      });
    }
  }, [user]);

  const handleLocationSelect = (lat, lng) => setLocation({ lat, lng });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!location) return setError('Please select a location on the map');
    setLoading(true);
    setError('');
    setResult(null);

    if (!isOnline) {
      queueOfflineIssue({ ...form, longitude: location.lng, latitude: location.lat, offlineCreated: true });
      setResult({ offline: true });
      setLoading(false);
      return;
    }

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    formData.append('longitude', location.lng);
    formData.append('latitude', location.lat);
    files.forEach(f => formData.append('media', f));

    const res = await issueAPI.createIssue(formData);
    setLoading(false);

    if (res.isDuplicate && res.alreadyReportedByYou) {
      setError(res.message);
      setResult({ blocked: true, issue: res.issue, cluster: res.cluster });
      return;
    }

    if (res.success) {
      setResult(res);
      if (res.isDuplicate && res.issue?._id) {
        setTimeout(() => navigate(`/issues/${res.issue._id}`), 2500);
      } else if (!res.isDuplicate) {
        setTimeout(() => navigate(`/issues/${res.issue._id}`), 2000);
      }
    } else {
      setError(res.message || 'Failed to submit');
    }
  };

  const subtypes = form.category ? categories[form.category] || [] : [];

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="page-header">
          <h1>{t('report')}</h1>
          <p>Duplicate reports at the same location are automatically blocked or merged</p>
        </div>

        {result?.isDuplicate && !result?.blocked && (
          <div className="duplicate-alert">
            <span>🔗</span>
            <div>
              <strong>{result.message}</strong>
              <p>Your report was merged — this issue is already tracked.</p>
              {result.issue?._id && (
                <Link to={`/issues/${result.issue._id}`} className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem' }}>
                  View existing issue →
                </Link>
              )}
            </div>
          </div>
        )}

        {result?.blocked && (
          <div className="alert alert-error">
            <strong>Duplicate blocked</strong>
            <p style={{ marginTop: '0.25rem' }}>{error}</p>
            {result.issue?._id && (
              <Link to={`/issues/${result.issue._id}`} className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem' }}>
                View your existing report →
              </Link>
            )}
          </div>
        )}

        {result?.offline && (
          <div className="alert alert-info">
            Issue saved offline. It will sync automatically when you're back online.
          </div>
        )}

        {error && !result?.blocked && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label>{t('title')}</label>
              <input className="form-control" required value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of the issue" />
            </div>

            <div className="form-group">
              <label>{t('description')}</label>
              <textarea className="form-control" required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detailed description with landmarks..." />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('category')}</label>
                <select className="form-control" required value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value, subtype: '' }))}>
                  <option value="">Select category</option>
                  {Object.keys(categories).map(cat => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Subtype</label>
                <select className="form-control" value={form.subtype}
                  onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))}>
                  <option value="">Select subtype</option>
                  {subtypes.map(st => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('severity')} (1-5)</label>
                <input type="range" min="1" max="5" className="form-control"
                  value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} />
                <span>{form.severity}/5</span>
              </div>
              <div className="form-group">
                <label>Urgency (1-5)</label>
                <input type="range" min="1" max="5" className="form-control"
                  value={form.urgency} onChange={e => setForm(f => ({ ...f, urgency: e.target.value }))} />
                <span>{form.urgency}/5</span>
              </div>
            </div>

            <div className="form-group">
              <label>Address / Landmark</label>
              <input className="form-control" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Nearby landmark for easy identification" />
            </div>

            <div className="form-group">
              <label>Photo/Video Evidence</label>
              <input type="file" className="form-control" multiple accept="image/*,video/*"
                onChange={e => setFiles([...e.target.files])} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isAnonymous}
                onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))} />
              {t('anonymous')}
            </label>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <label style={{ marginBottom: '0.75rem', display: 'block', fontWeight: 600 }}>
              Pin Location (click map to set exact spot)
            </label>
            {location && (
              <IssueMap
                center={[location.lat, location.lng]}
                zoom={15}
                pickerMode
                onLocationSelect={handleLocationSelect}
                className="large"
              />
            )}
            {location && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Checking for duplicates...' : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
