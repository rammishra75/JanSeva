import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleBadge from './RoleBadge';

export default function Navbar() {
  const { user, logout, language, changeLanguage, t, isOnline, offlineQueue } = useAuth();
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  const roleClass = user ? `navbar-${user.role}` : '';

  return (
    <nav className={`navbar ${roleClass}`}>
      <div className="container">
        <Link to="/" className="logo">
          <span className="logo-icon">🏛️</span>
          Jan<span>Seva</span>
        </Link>

        <ul className="nav-links">
          <li><Link to="/" className={isActive('/')}>{t('home')}</Link></li>
          <li><Link to="/issues" className={isActive('/issues')}>{t('issues')}</Link></li>

          {user?.role === 'citizen' && (
            <li><Link to="/report" className={isActive('/report')}>{t('report')}</Link></li>
          )}

          {(user?.role === 'authority' || user?.role === 'admin') && (
            <li><Link to="/officer" className={isActive('/officer')}>Workbench</Link></li>
          )}

          {user?.role === 'admin' && (
            <li><Link to="/dashboard" className={isActive('/dashboard')}>Analytics</Link></li>
          )}
        </ul>

        <div className="nav-actions">
          {!isOnline && <span className="offline-badge">{t('offline')}</span>}
          {offlineQueue.length > 0 && (
            <span className="offline-badge">{offlineQueue.length} pending</span>
          )}

          <select className="lang-select" value={language} onChange={e => changeLanguage(e.target.value)}>
            <option value="en">EN</option>
            <option value="hi">हि</option>
          </select>

          {user ? (
            <div className="user-menu">
              <div className="user-info">
                <span className="user-name">{user.name?.split(' ')[0]}</span>
                <RoleBadge role={user.role} size="sm" />
              </div>
              {user.role === 'citizen' && (
                <span className="rep-score">{user.reputation?.score || 50} pts</span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={logout}>{t('logout')}</button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">{t('login')}</Link>
              <Link to="/register" className="btn btn-primary btn-sm">{t('register')}</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
