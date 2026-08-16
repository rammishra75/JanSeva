import User from '../models/User.js';
import Authority from '../models/Authority.js';

export function getVoteWeight(user) {
  if (!user || user.isShadowBanned) return 0;
  const levelWeights = { new: 0.5, trusted: 1, verified: 1.5, champion: 2 };
  return levelWeights[user.reputation?.level] || 1;
}

export function computeCrowdSeverity(issue) {
  const up = issue.upvoteCount || 0;
  const down = issue.downvoteCount || 0;
  const total = up + down;
  if (total === 0) return issue.severity.userReported;

  const ratio = up / total;
  const crowdBoost = Math.round(ratio * 2);
  const daysOpen = (Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const timeEscalation = daysOpen > 7 ? 1 : daysOpen > 3 ? 0.5 : 0;

  const computed = Math.min(5, Math.max(1,
    Math.round(issue.severity.userReported * 0.3 + crowdBoost * 0.5 + timeEscalation + 1)
  ));

  return computed;
}

export async function updateCitizenReputation(userId, action) {
  const user = await User.findById(userId);
  if (!user) return;

  const deltas = {
    accurate_report: { score: 2, field: 'accurateReports' },
    verified_issue: { score: 3, field: 'verificationsDone' },
    spam_report: { score: -10, field: 'spamReports' },
    false_verification: { score: -5 }
  };

  const delta = deltas[action];
  if (!delta) return;

  user.reputation.score = Math.max(0, Math.min(100, user.reputation.score + delta.score));
  if (delta.field) user.reputation[delta.field] += 1;
  user.updateReputationLevel();
  await user.save();
  return user;
}

export async function updateAuthorityReputation(authorityId, resolutionHours, citizenApproved) {
  const authority = await Authority.findById(authorityId);
  if (!authority) return;

  const total = authority.reputation.totalResolved + 1;
  authority.reputation.avgResolutionHours =
    (authority.reputation.avgResolutionHours * authority.reputation.totalResolved + resolutionHours) / total;
  authority.reputation.totalResolved = total;

  if (citizenApproved) {
    authority.reputation.citizenSatisfaction =
      (authority.reputation.citizenSatisfaction * (total - 1) + 100) / total;
    authority.reputation.score = Math.min(100, authority.reputation.score + 1);
  } else {
    authority.reputation.citizenSatisfaction =
      (authority.reputation.citizenSatisfaction * (total - 1)) / total;
    authority.reputation.score = Math.max(0, authority.reputation.score - 3);
  }

  await authority.save();
  return authority;
}

export function checkAnomaly(user, recentReportsInArea) {
  if (user.reportCount > 20 && user.reputation.spamReports > 5) return 'shadow_ban';
  if (recentReportsInArea > 5) return 'rate_limit';
  if (user.reputation.score < 10) return 'flag_review';
  return null;
}
