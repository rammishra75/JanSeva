import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Authority from '../models/Authority.js';

dotenv.config();

const required = [
  'OFFICER_NAME', 'OFFICER_EMAIL', 'OFFICER_PASSWORD',
  'AUTHORITY_NAME', 'AUTHORITY_CODE', 'AUTHORITY_DEPARTMENT'
];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variable(s): ${missing.join(', ')}`);
  process.exit(1);
}

async function createAuthority() {
  await mongoose.connect(process.env.MONGODB_URI);

  const issueTypes = (process.env.AUTHORITY_ISSUE_TYPES || 'other')
    .split(',')
    .map(type => type.trim())
    .filter(Boolean);
  const slaHours = Number(process.env.AUTHORITY_SLA_HOURS || 72);

  const authority = await Authority.findOneAndUpdate(
    { code: process.env.AUTHORITY_CODE.toUpperCase() },
    {
      $set: {
        name: process.env.AUTHORITY_NAME,
        code: process.env.AUTHORITY_CODE.toUpperCase(),
        department: process.env.AUTHORITY_DEPARTMENT,
        issueTypes,
        slaHours: Number.isFinite(slaHours) ? slaHours : 72,
        isActive: true
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const password = await bcrypt.hash(process.env.OFFICER_PASSWORD, 12);
  const officer = await User.findOneAndUpdate(
    { email: process.env.OFFICER_EMAIL.toLowerCase() },
    {
      $set: {
        name: process.env.OFFICER_NAME,
        email: process.env.OFFICER_EMAIL.toLowerCase(),
        password,
        role: 'authority',
        authorityId: authority._id,
        isShadowBanned: false
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Authority is ready: ${authority.name} (${authority.code})`);
  console.log(`Officer account is ready: ${officer.email}`);
}

createAuthority()
  .catch(error => {
    console.error('Could not create authority officer:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
