/**
 * OX-DIGITAL Education — Secure Administrator Password Rotation Utility
 *
 * Strictly interactive. Prompts operator for new password with hidden echo.
 * Enforces minimum 16 characters. Hashes with bcryptjs (10 rounds).
 * Updates only the verified existing admin@edu.com record.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

function getHiddenPassword(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      return reject(new Error('Terminal is not a TTY. Interactive terminal is required for secure hidden password entry.'));
    }

    process.stdout.write(promptText);

    let password = '';
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const cleanup = () => {
      try {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRaw || false);
        }
        process.stdin.pause();
      } catch (_) {}
    };

    const onData = (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        const char = chunk[i];

        // Enter (\r or \n)
        if (char === '\r' || char === '\n') {
          process.stdin.removeListener('data', onData);
          cleanup();
          process.stdout.write('\n');
          return resolve(password);
        }

        // Ctrl+C (0x03)
        if (char === '\u0003') {
          process.stdin.removeListener('data', onData);
          cleanup();
          process.stdout.write('\n[ABORTED by user]\n');
          process.exit(130);
        }

        // Ctrl+D (0x04)
        if (char === '\u0004') {
          process.stdin.removeListener('data', onData);
          cleanup();
          process.stdout.write('\n');
          return resolve(password);
        }

        // Backspace (\b = 0x08, DEL = 0x7f)
        if (char === '\b' || char === '\x7f') {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          continue;
        }

        // Ignore control / escape sequences
        if (char < ' ' && char !== '\t') {
          continue;
        }

        password += char;
      }
    };

    process.stdin.on('data', onData);
  });
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@edu.com';

  console.log('================================================================');
  console.log('OX-DIGITAL Education — Admin Password Rotation Utility');
  console.log('================================================================\n');

  // 1. Verify TTY
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('❌ [ERROR] Interactive terminal (TTY) is required for secure hidden password entry.');
    console.error('   Please run with:');
    console.error('     docker compose --profile tools --env-file .env.production -f docker-compose.production.yml run --rm -it --no-deps prisma-migrate node /app/scripts/update_admin_password.mjs\n');
    process.exit(1);
  }

  // 2. Read-only verify existing administrator record
  console.log(`🔍 Verifying existing administrator record for: ${adminEmail}`);
  const existingAdmin = await db.user.findFirst({
    where: {
      AND: [
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

  if (!existingAdmin) {
    console.error(`❌ [ERROR] No administrator found matching email "${adminEmail}" with role "ADMIN".`);
    console.error('   Zero database modifications performed.');
    process.exit(1);
  }

  console.log(`✅ Administrator verified: [ID: ${existingAdmin.id}] [Email: ${existingAdmin.email}] [Role: ${existingAdmin.role}] [Name: ${existingAdmin.name}]`);
  console.log('\n🔒 Please enter the new administrator password.');
  console.log('   Input will be hidden. Enforcing minimum length: 16 characters.\n');

  // 3. Prompt twice with hidden input
  let pass1;
  let pass2;

  try {
    pass1 = await getHiddenPassword('Enter new administrator password: ');
  } catch (err) {
    console.error(`\n❌ [ERROR] Failed to read password: ${err.message}`);
    process.exit(1);
  }

  if (!pass1 || pass1.length < 16) {
    console.error('❌ [ERROR] Password rejected: Minimum length is 16 characters.');
    pass1 = null;
    process.exit(1);
  }

  try {
    pass2 = await getHiddenPassword('Confirm new administrator password: ');
  } catch (err) {
    console.error(`\n❌ [ERROR] Failed to read confirmation: ${err.message}`);
    pass1 = null;
    process.exit(1);
  }

  if (pass1 !== pass2) {
    console.error('❌ [ERROR] Password confirmation does not match.');
    pass1 = null;
    pass2 = null;
    process.exit(1);
  }

  // 4. Hash using project standard bcrypt (10 rounds)
  console.log('\n⚡ Hashing password using project standard bcrypt (cost factor: 10)...');
  const hashedPassword = await bcrypt.hash(pass1, 10);
  pass1 = null;
  pass2 = null;

  // 5. Targeted update on existing administrator only
  console.log('⚡ Updating password in database...');
  const updatedUser = await db.user.update({
    where: { id: existingAdmin.id },
    data: { password: hashedPassword },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      updatedAt: true
    }
  });

  // 6. Verify result
  if (updatedUser.id !== existingAdmin.id || updatedUser.email !== existingAdmin.email || updatedUser.role !== 'ADMIN') {
    console.error('❌ [CRITICAL] Unexpected state after update! Identity mismatch.');
    process.exit(1);
  }

  console.log('✅ [SUCCESS] Administrator password updated successfully.');
  console.log(`- ID: ${updatedUser.id}`);
  console.log(`- Email: ${updatedUser.email}`);
  console.log(`- Role: ${updatedUser.role}`);
  console.log(`- Updated At: ${updatedUser.updatedAt.toISOString()}`);
  console.log('   Identity preserved. Secrets and hashes are never printed.');
}

main()
  .catch((err) => {
    console.error('❌ [FATAL ERROR] An unexpected error occurred:', err.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
