import mongoose from 'mongoose';

const authoritySchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  issueTypes: [{ type: String }],
  jurisdiction: {
    type: { type: String, enum: ['Polygon'], default: 'Polygon' },
    coordinates: [[[Number]]]
  },
  contactEmail: String,
  contactPhone: String,
  slaHours: { type: Number, default: 72 },
  escalationAuthorityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Authority' },
  reputation: {
    score: { type: Number, default: 50 },
    avgResolutionHours: { type: Number, default: 0 },
    slaComplianceRate: { type: Number, default: 100 },
    citizenSatisfaction: { type: Number, default: 0 },
    totalResolved: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Authority', authoritySchema);
