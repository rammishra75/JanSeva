import mongoose from 'mongoose';

const clusterSchema = new mongoose.Schema({
  primaryIssueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
  issueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Issue' }],
  reportCount: { type: Number, default: 1 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  category: String,
  subtype: String,
  title: String,
  status: { type: String, default: 'open' },
  similarityScore: { type: Number, default: 1 },
  mergedAt: { type: Date, default: Date.now }
}, { timestamps: true });

clusterSchema.index({ location: '2dsphere' });

export default mongoose.model('IssueCluster', clusterSchema);
