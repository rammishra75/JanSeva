import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

dotenv.config();

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing ADMIN_NAME, ADMIN_EMAIL, or ADMIN_PASSWORD environment variable.');
  process.exit(1);
}

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);

  const password = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    {
      $set: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL.toLowerCase(),
        password,
        role: 'admin',
        isShadowBanned: false
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Admin account is ready: ${admin.email}`);
}

createAdmin()
  .catch(error => {
    console.error('Could not create admin:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
