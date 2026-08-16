import Authority from '../models/Authority.js';

const CATEGORY_AUTHORITY_MAP = {
  roads: ['PWD', 'MUNICIPAL'],
  water: ['WATER_BOARD', 'MUNICIPAL'],
  sanitation: ['MUNICIPAL', 'HEALTH'],
  electricity: ['ELECTRICITY_BOARD'],
  public_safety: ['POLICE', 'FIRE'],
  environment: ['ENVIRONMENT', 'MUNICIPAL'],
  health: ['HEALTH', 'MUNICIPAL'],
  other: ['MUNICIPAL']
};

const MULTI_DEPT_ISSUES = {
  'waterlogging': ['water', 'roads'],
  'broken_drain': ['water', 'sanitation'],
  'streetlight_water': ['electricity', 'water']
};

export async function routeIssue(issue) {
  const departments = MULTI_DEPT_ISSUES[issue.subtype]
    ? MULTI_DEPT_ISSUES[issue.subtype]
    : [issue.category];

  const authorityCodes = new Set();
  for (const dept of departments) {
    const codes = CATEGORY_AUTHORITY_MAP[dept] || CATEGORY_AUTHORITY_MAP.other;
    codes.forEach(c => authorityCodes.add(c));
  }

  const authorities = await Authority.find({
    code: { $in: [...authorityCodes] },
    isActive: true,
    issueTypes: { $in: [issue.category, issue.subtype].filter(Boolean) }
  });

  if (authorities.length === 0) {
    const fallback = await Authority.find({ isActive: true }).limit(1);
    return fallback;
  }

  const [lon, lat] = issue.location.coordinates;
  const jurisdictionMatches = authorities.filter(auth => {
    if (!auth.jurisdiction?.coordinates?.length) return true;
    return pointInPolygon(lon, lat, auth.jurisdiction.coordinates[0]);
  });

  return jurisdictionMatches.length ? jurisdictionMatches : authorities;
}

export function calculateSLADeadline(authorities) {
  const minSla = Math.min(...authorities.map(a => a.slaHours || 72));
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + minSla);
  return deadline;
}

function pointInPolygon(lon, lat, polygon) {
  if (!polygon || polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export async function checkSLABreaches() {
  const Authority = (await import('../models/Authority.js')).default;
  const Issue = (await import('../models/Issue.js')).default;

  const breached = await Issue.find({
    slaDeadline: { $lt: new Date() },
    status: { $in: ['open', 'acknowledged', 'in_progress'] },
    escalated: false
  }).populate('primaryAuthority assignedAuthorities');

  for (const issue of breached) {
    const primary = issue.primaryAuthority;
    if (primary?.escalationAuthorityId) {
      issue.escalated = true;
      issue.escalatedTo = primary.escalationAuthorityId;
      issue.assignedAuthorities.push(primary.escalationAuthorityId);
      issue.lifecycle.push({
        stage: 'in_progress',
        enteredAt: new Date(),
        department: 'escalation',
        note: 'SLA breached - escalated to higher authority'
      });
      await issue.save();
    }
  }

  return breached.length;
}
