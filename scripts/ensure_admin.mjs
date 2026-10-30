/**
 * OX-DIGITAL Education — Administrator Verification and Bootstrap Utility
 *
 * MODES OF OPERATION:
 *
 * 1. READ-ONLY VERIFICATION MODE (Default / `node scripts/ensure_admin.mjs` or `--verify`):
 *    - Strictly READ-ONLY. Cannot create, modify, or delete any account.
 *    - Checks whether an administrator account already exists.
 *    - Preserves all existing credentials, email, role, and permissions intact.
 *    - Exits 0 if an administrator exists.
 *    - Exits 1 if no administrator is found (without modifying the database).
 *
 * 2. EXPLICIT BOOTSTRAP MODE (`node scripts/ensure_admin.mjs --bootstrap`):
 *    - Requires explicit operator action via the `--bootstrap` CLI flag or `BOOTSTRAP_ADMIN=1`.
 *    - If an administrator ALREADY exists, it informs the operator and preserves credentials intact.
 *      It NEVER overwrites or resets an existing administrator password.
 *    - If NO administrator exists, it requires `INITIAL_ADMIN_PASSWORD` (minimum 8 characters).
 *    - Never embeds or logs passwords, hashes, or tokens.
 *    - Never executes unauthenticated HTTP requests.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const isBootstrapMode = process.argv.includes('--bootstrap') || process.env.BOOTSTRAP_ADMIN === '1';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@edu.com';

  console.log('================================================================');
  console.log('OX-DIGITAL Education — Administrator Management Utility');
  console.log(`Mode: ${isBootstrapMode ? 'EXPLICIT BOOTSTRAP (--bootstrap)' : 'READ-ONLY VERIFICATION'}`);
  console.log('================================================================\n');

  // 1. Read-only probe for existing administrator
  const existingAdmin = await db.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { role: 'ADMIN' }
      ]
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      createdAt: true
    }
  });

  if (existingAdmin) {
    console.log('✅ [OX-DIGITAL SECURE ADMIN] Administrator account verified.');
    console.log(`- ID: ${existingAdmin.id}`);
    console.log(`- Email: ${existingAdmin.email}`);
    console.log(`- Role: ${existingAdmin.role}`);
    console.log(`- Name: ${existingAdmin.name}`);
    console.log(`- Created At: ${existingAdmin.createdAt.toISOString()}`);
    console.log('\n🛡️ Existing credentials, email, role, and permissions are preserved intact.');
    console.log('   Zero database modifications performed.');
    return;
  }

  // 2. Administrator does not exist
  if (!isBootstrapMode) {
    console.error('⚠️ [OX-DIGITAL SECURE ADMIN] No administrator account found in the database.');
    console.error('   Running in READ-ONLY VERIFICATION mode: No accounts created or modified.');
    console.error('\n   To securely bootstrap the initial administrator account, run:');
    console.error('     INITIAL_ADMIN_PASSWORD=<strong_password> node scripts/ensure_admin.mjs --bootstrap');
    process.exit(1);
  }

  // 3. Explicit Bootstrap Mode
  console.log('⚡ Initializing Administrator Bootstrap Procedure...');
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!initialPassword || initialPassword.length < 8) {
    console.error('❌ [OX-DIGITAL SECURE ADMIN] Bootstrap failed.');
    console.error('   Initial administrator creation requires setting:');
    console.error('     INITIAL_ADMIN_PASSWORD=<strong_password_at_least_8_chars>');
    console.error('   Default passwords are strictly prohibited.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(initialPassword, 10);
  const newAdmin = await db.user.create({
    data: {
      name: 'OX-DIGITAL Administrator',
      email: adminEmail,
      password: hash,
      role: 'ADMIN'
    },
    select: {
      id: true,
      email: true,
      role: true
    }
  });

  console.log('✅ [OX-DIGITAL SECURE ADMIN] Initial administrator account created successfully.');
  console.log(`- ID: ${newAdmin.id}`);
  console.log(`- Email: ${newAdmin.email}`);
  console.log(`- Role: ${newAdmin.role}`);
  console.log('   Credentials established securely. Secrets are never logged.');
}

main()
  .catch((err) => {
    console.error('❌ [OX-DIGITAL SECURE ADMIN] Execution error:', err.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
