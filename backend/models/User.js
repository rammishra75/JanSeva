import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  phone: { type: String },
  role: {
    type: String,
    enum: ['citizen', 'authority', 'admin'],
    default: 'citizen'
  },
  authorityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Authority' },
  preferredLanguage: { type: String, default: 'en' },
  isAnonymous: { type: Boolean, default: false },
  reputation: {
    score: { type: Number, default: 50, min: 0, max: 100 },
    accurateReports: { type: Number, default: 0 },
    verificationsDone: { type: Number, default: 0 },
    spamReports: { type: Number, default: 0 },
    level: { type: String, enum: ['new', 'trusted', 'verified', 'champion'], default: 'new' }
  },
  isShadowBanned: { type: Boolean, default: false },
  reportCount: { type: Number, default: 0 },
  lastReportAt: { type: Date },
  badges: [{ type: String }],
  areaContributions: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.methods.updateReputationLevel = function () {
  const score = this.reputation.score;
  if (score >= 80) this.reputation.level = 'champion';
  else if (score >= 65) this.reputation.level = 'verified';
  else if (score >= 40) this.reputation.level = 'trusted';
  else this.reputation.level = 'new';
};

export default mongoose.model('User', userSchema);
