import mongoose from 'mongoose';

const lifecycleEntrySchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['created', 'acknowledged', 'in_progress', 'resolved', 'verified', 'reopened'],
    required: true
  },
  enteredAt: { type: Date, default: Date.now },
  exitedAt: Date,
  department: String,
  note: String
}, { _id: false });

const voteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vote: { type: String, enum: ['up', 'down'], required: true },
  weight: { type: Number, default: 1 }
}, { _id: false });

const verificationVoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resolved: { type: Boolean, required: true },
  comment: String
}, { _id: false });

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: ['roads', 'water', 'sanitation', 'electricity', 'public_safety', 'environment', 'health', 'other']
  },
  subtype: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  address: String,
  media: [{
    url: String,
    type: { type: String, enum: ['image', 'video'] },
    blurred: { type: Boolean, default: false }
  }],
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAnonymous: { type: Boolean, default: false },
  severity: {
    userReported: { type: Number, min: 1, max: 5, default: 3 },
    crowdScore: { type: Number, default: 0 },
    computed: { type: Number, default: 3 }
  },
  urgency: { type: Number, min: 1, max: 5, default: 3 },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'in_progress', 'resolved', 'verified', 'reopened', 'closed'],
    default: 'open'
  },
  lifecycle: [lifecycleEntrySchema],
  clusterId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueCluster' },
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue' },
  reportCount: { type: Number, default: 1 },
  reporters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  votes: [voteSchema],
  upvoteCount: { type: Number, default: 0 },
  downvoteCount: { type: Number, default: 0 },
  assignedAuthorities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Authority' }],
  primaryAuthority: { type: mongoose.Schema.Types.ObjectId, ref: 'Authority' },
  slaDeadline: Date,
  escalated: { type: Boolean, default: false },
  escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Authority' },
  resolutionProof: [{
    url: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  resolutionNote: String,
  verificationVotes: [verificationVoteSchema],
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  resolvedAt: Date,
  verifiedAt: Date,
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  language: { type: String, default: 'en' },
  translatedDescription: String,
  offlineCreated: { type: Boolean, default: false },
  syncedAt: Date,
  textFingerprint: String,
  imageHashes: [String],
  locationGrid: String
}, { timestamps: true });

issueSchema.index({ location: '2dsphere' });
issueSchema.index({ category: 1, status: 1 });
issueSchema.index({ clusterId: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ textFingerprint: 1, category: 1 });
issueSchema.index({ locationGrid: 1, category: 1 });
issueSchema.index({ reporters: 1, textFingerprint: 1 });

issueSchema.pre('save', function (next) {
  if (this.isNew) {
    this.lifecycle.push({
      stage: 'created',
      enteredAt: new Date(),
      department: 'citizen_report'
    });
  }
  next();
});

export default mongoose.model('Issue', issueSchema);
