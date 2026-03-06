import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...\n");

  const accounts = [
    {
      email: "superadmin@abbey.com",
      name: "Super Admin",
      password: "SuperAdmin123!",
      role: Role.SUPER_ADMIN,
    },
    {
      email: "adminmanager@abbey.com",
      name: "Admin Manager",
      password: "AdminManager123!",
      role: Role.ADMIN_MANAGER,
    },
    {
      email: "salesmanager@abbey.com",
      name: "Sales Manager",
      password: "SalesManager123!",
      role: Role.SALES_MANAGER,
    },
    {
      email: "admin@abbey.com",
      name: "Admin User",
      password: "Admin123!",
      role: Role.ADMIN,
    },
    {
      email: "sales@abbey.com",
      name: "Sales User",
      password: "Sales123!",
      role: Role.SALES,
    },
  ];

  for (const acct of accounts) {
    const hash = await bcrypt.hash(acct.password, 12);
    const user = await prisma.user.upsert({
      where: { email: acct.email },
      update: { passwordHash: hash, role: acct.role, status: "ACTIVE" },
      create: {
        email: acct.email,
        name: acct.name,
        passwordHash: hash,
        role: acct.role,
        status: "ACTIVE",
      },
    });
    console.log(`  ${acct.role}: ${user.email} (password: ${acct.password})`);
  }

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
