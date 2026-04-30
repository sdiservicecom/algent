import { PrismaClient, Role, TxType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin1234';

  const existing = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'Algent',
        username: adminUsername,
        passwordHash,
        role: Role.ADMIN,
        balance: 0,
      },
    });
    await prisma.pointTransaction.create({
      data: {
        userId: admin.id,
        type: TxType.INITIAL_CREDIT,
        amount: 0,
        balanceAfter: 0,
      },
    });
    console.log(`Admin créé: ${adminUsername} / ${adminPassword}`);
  } else {
    console.log(`Admin déjà présent: ${adminUsername}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
