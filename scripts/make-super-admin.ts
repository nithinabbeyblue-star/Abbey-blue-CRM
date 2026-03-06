/**
 * One-off script: Create or update a user to be Super Admin with your email.
 *
 * Usage (set your email and password, then run):
 *   SET MY_EMAIL=your@email.com
 *   SET MY_PASSWORD=YourSecurePassword123
 *   pnpm exec tsx scripts/make-super-admin.ts
 *
 * Or in one line (PowerShell):
 *   $env:MY_EMAIL="your@email.com"; $env:MY_PASSWORD="YourSecurePassword123"; pnpm exec tsx scripts/make-super-admin.ts
 */
import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (process.env.MY_EMAIL || process.env.MAKE_SUPER_ADMIN_EMAIL)?.trim().toLowerCase();
  const password = process.env.MY_PASSWORD || process.env.MAKE_SUPER_ADMIN_PASSWORD;

  if (!email) {
    console.error("Missing email. Set MY_EMAIL or MAKE_SUPER_ADMIN_EMAIL.");
    console.error('Example (PowerShell): $env:MY_EMAIL="you@example.com"; $env:MY_PASSWORD="YourPassword"; pnpm exec tsx scripts/make-super-admin.ts');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("Missing or short password. Set MY_PASSWORD (at least 8 characters).");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.SUPER_ADMIN,
      status: "ACTIVE",
      passwordHash,
      mustSetPassword: false,
    },
    create: {
      email,
      name: "Super Admin",
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: "ACTIVE",
      mustSetPassword: false,
    },
  });

  console.log("Done. You can log in as Super Admin with:");
  console.log("  Email:", user.email);
  console.log("  Password: (the one you set in MY_PASSWORD)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
