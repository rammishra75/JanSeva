const ROLE_CONFIG = {
  citizen: { label: 'Citizen', icon: '👤', className: 'role-citizen' },
  authority: { label: 'Officer', icon: '🏛️', className: 'role-authority' },
  admin: { label: 'Admin', icon: '⚙️', className: 'role-admin' }
};

export default function RoleBadge({ role, size = 'md' }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.citizen;
  return (
    <span className={`role-badge ${config.className} role-badge-${size}`}>
      <span className="role-icon">{config.icon}</span>
      {config.label}
    </span>
  );
}

export function getRoleLabel(role) {
  return ROLE_CONFIG[role]?.label || 'Citizen';
}
