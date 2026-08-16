const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'with', 'this', 'that', 'it', 'near', 'there']);

export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .sort()
    .join(' ');
}

export function textSimilarity(text1, text2) {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1;

  const words1 = new Set(norm1.split(' ').filter(Boolean));
  const words2 = new Set(norm2.split(' ').filter(Boolean));
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.length / union.size;
}

export function combinedTextSimilarity(issue1, issue2) {
  const full1 = `${issue1.title || ''} ${issue1.description || ''}`;
  const full2 = `${issue2.title || ''} ${issue2.description || ''}`;
  const fullScore = textSimilarity(full1, full2);
  const titleScore = textSimilarity(issue1.title, issue2.title);
  const descScore = textSimilarity(issue1.description, issue2.description);
  return Math.max(fullScore, titleScore * 0.7 + descScore * 0.3);
}

export function getLocationGrid(lat, lng, precision = 3) {
  return `${Number(lat).toFixed(precision)},${Number(lng).toFixed(precision)}`;
}

export function createTextFingerprint(text) {
  const normalized = normalizeText(text);
  return normalized || text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function simpleImageHash(buffer) {
  const str = buffer.toString('base64').slice(0, 64);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function imageHashSimilarity(hash1, hash2) {
  if (hash1 === hash2) return 1;
  const len = Math.min(hash1.length, hash2.length);
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (hash1[i] === hash2[i]) matches++;
  }
  return matches / Math.max(hash1.length, hash2.length);
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeDuplicateScore(issue1, issue2, radiusMeters = 150) {
  const [lon1, lat1] = issue1.location.coordinates;
  const [lon2, lat2] = issue2.location.coordinates;
  const distance = haversineDistance(lat1, lon1, lat2, lon2);

  if (issue1.category !== issue2.category) return 0;

  const locationScore = distance <= radiusMeters ? 1 - (distance / radiusMeters) : 0;
  const textScore = combinedTextSimilarity(issue1, issue2);

  // Exact fingerprint match is a strong duplicate signal
  if (issue1.textFingerprint && issue1.textFingerprint === issue2.textFingerprint) {
    return Math.max(0.85, (locationScore * 0.3) + (textScore * 0.3) + 0.55);
  }

  if (distance > radiusMeters && textScore < 0.7) return 0;

  let imageScore = 0;
  if (issue1.imageHashes?.length && issue2.imageHashes?.length) {
    const scores = issue1.imageHashes.map(h1 =>
      Math.max(...issue2.imageHashes.map(h2 => imageHashSimilarity(h1, h2)))
    );
    imageScore = scores.length ? Math.max(...scores) : 0;
  }

  return (locationScore * 0.35) + (textScore * 0.45) + (imageScore * 0.2);
}
