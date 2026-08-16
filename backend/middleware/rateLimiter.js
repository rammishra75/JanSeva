import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests' }
});

export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.MAX_REPORTS_PER_HOUR) || 10,
  message: { success: false, message: 'Report limit exceeded. Try again later.' },
  keyGenerator: (req) => req.user?._id?.toString() || req.ip
});

export const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many votes' }
});
