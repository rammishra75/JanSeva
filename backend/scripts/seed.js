import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Authority from '../models/Authority.js';
import Issue from '../models/Issue.js';

dotenv.config();

const authorities = [
  { name: 'Municipal Corporation', code: 'MUNICIPAL', department: 'Municipal', issueTypes: ['roads', 'water', 'sanitation', 'environment', 'other'], slaHours: 72 },
  { name: 'Public Works Department', code: 'PWD', department: 'Infrastructure', issueTypes: ['roads', 'bridges'], slaHours: 96 },
  { name: 'Water Supply Board', code: 'WATER_BOARD', department: 'Water', issueTypes: ['water', 'sanitation'], slaHours: 48 },
  { name: 'Electricity Board', code: 'ELECTRICITY_BOARD', department: 'Electricity', issueTypes: ['electricity'], slaHours: 24 },
  { name: 'Health Department', code: 'HEALTH', department: 'Health', issueTypes: ['health', 'sanitation'], slaHours: 48 },
  { name: 'Environment Department', code: 'ENVIRONMENT', department: 'Environment', issueTypes: ['environment'], slaHours: 72 },
  { name: 'Police Department', code: 'POLICE', department: 'Public Safety', issueTypes: ['public_safety'], slaHours: 12 },
  { name: 'Fire Department', code: 'FIRE', department: 'Public Safety', issueTypes: ['public_safety'], slaHours: 6 }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/janseva');
  console.log('Connected to MongoDB');

  await User.deleteMany({});
  await Authority.deleteMany({});
  await Issue.deleteMany({});

  const createdAuthorities = await Authority.insertMany(authorities);

  const municipal = createdAuthorities.find(a => a.code === 'MUNICIPAL');
  const pwd = createdAuthorities.find(a => a.code === 'PWD');
  municipal.escalationAuthorityId = pwd._id;
  await municipal.save();

  const hashed = await bcrypt.hash('password123', 12);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@janseva.gov',
    password: hashed,
    role: 'admin',
    reputation: { score: 90, level: 'champion' }
  });

  const authorityUser = await User.create({
    name: 'Municipal Officer',
    email: 'officer@janseva.gov',
    password: hashed,
    role: 'authority',
    authorityId: municipal._id,
    reputation: { score: 75, level: 'verified' }
  });

  const citizen = await User.create({
    name: 'Rajesh Kumar',
    email: 'citizen@example.com',
    password: hashed,
    role: 'citizen',
    reputation: { score: 55, level: 'trusted', accurateReports: 12 }
  });

  const sampleIssues = [
    {
      title: 'Large pothole on Main Road',
      description: 'Deep pothole causing accidents near the market area. Multiple vehicles damaged.',
      category: 'roads',
      subtype: 'pothole',
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      address: 'Connaught Place, New Delhi',
      reportedBy: citizen._id,
      reporters: [citizen._id],
      severity: { userReported: 4, computed: 4, crowdScore: 3 },
      urgency: 4,
      status: 'in_progress',
      assignedAuthorities: [municipal._id, pwd._id],
      primaryAuthority: municipal._id,
      slaDeadline: new Date(Date.now() + 48 * 3600000),
      upvoteCount: 15,
      downvoteCount: 2,
      reportCount: 8,
      lifecycle: [
        { stage: 'created', enteredAt: new Date(Date.now() - 5 * 86400000), exitedAt: new Date(Date.now() - 4 * 86400000), department: 'citizen_report' },
        { stage: 'acknowledged', enteredAt: new Date(Date.now() - 4 * 86400000), exitedAt: new Date(Date.now() - 2 * 86400000), department: 'Municipal' },
        { stage: 'in_progress', enteredAt: new Date(Date.now() - 2 * 86400000), department: 'Municipal' }
      ]
    },
    {
      title: 'No water supply for 3 days',
      description: 'Entire block has no water supply. Residents struggling.',
      category: 'water',
      subtype: 'no_water_supply',
      location: { type: 'Point', coordinates: [77.2200, 28.6200] },
      address: 'Karol Bagh, New Delhi',
      reportedBy: citizen._id,
      reporters: [citizen._id],
      severity: { userReported: 5, computed: 5, crowdScore: 4 },
      urgency: 5,
      status: 'open',
      assignedAuthorities: [createdAuthorities.find(a => a.code === 'WATER_BOARD')._id],
      primaryAuthority: createdAuthorities.find(a => a.code === 'WATER_BOARD')._id,
      slaDeadline: new Date(Date.now() + 24 * 3600000),
      upvoteCount: 22,
      reportCount: 12,
      lifecycle: [
        { stage: 'created', enteredAt: new Date(Date.now() - 3 * 86400000), department: 'citizen_report' }
      ]
    },
    {
      title: 'Garbage dump near school',
      description: 'Unattended garbage pile creating health hazard near primary school.',
      category: 'sanitation',
      subtype: 'garbage_dump',
      location: { type: 'Point', coordinates: [77.1950, 28.6050] },
      address: 'Rajendra Place, New Delhi',
      reportedBy: citizen._id,
      reporters: [citizen._id],
      severity: { userReported: 3, computed: 4, crowdScore: 3 },
      status: 'resolved',
      assignedAuthorities: [municipal._id],
      primaryAuthority: municipal._id,
      resolvedAt: new Date(Date.now() - 86400000),
      resolutionNote: 'Garbage cleared and area sanitized',
      verificationStatus: 'pending',
      upvoteCount: 8,
      reportCount: 3,
      lifecycle: [
        { stage: 'created', enteredAt: new Date(Date.now() - 10 * 86400000), exitedAt: new Date(Date.now() - 9 * 86400000), department: 'citizen_report' },
        { stage: 'acknowledged', enteredAt: new Date(Date.now() - 9 * 86400000), exitedAt: new Date(Date.now() - 7 * 86400000), department: 'Municipal' },
        { stage: 'in_progress', enteredAt: new Date(Date.now() - 7 * 86400000), exitedAt: new Date(Date.now() - 2 * 86400000), department: 'Municipal' },
        { stage: 'resolved', enteredAt: new Date(Date.now() - 86400000), department: 'Municipal' }
      ]
    }
  ];

  await Issue.insertMany(sampleIssues);

  console.log('\n--- Seed Complete ---');
  console.log('Admin:    admin@janseva.gov / password123');
  console.log('Authority: officer@janseva.gov / password123');
  console.log('Citizen:  citizen@example.com / password123');
  console.log(`Created ${createdAuthorities.length} authorities, 3 sample issues`);

  await mongoose.disconnect();
}

seed().catch(console.error);
