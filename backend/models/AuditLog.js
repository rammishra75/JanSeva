import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String
}, { timestamps: true });

auditSchema.index({ entityType: 1, entityId: 1 });
auditSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditSchema);
