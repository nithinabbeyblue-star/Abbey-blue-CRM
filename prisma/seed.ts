import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...\n");

  // Create Super Admin
  const superAdminPassword = await bcrypt.hash("admin123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@abbeylegal.com" },
    update: {},
    create: {
      email: "admin@abbeylegal.com",
      name: "Super Admin",
      passwordHash: superAdminPassword,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`  Super Admin: ${superAdmin.email} (password: admin123)`);

  // Create Key Coordinator
  const kcPassword = await bcrypt.hash("coord123", 12);
  const keyCoordinator = await prisma.user.upsert({
    where: { email: "coordinator@abbeylegal.com" },
    update: {},
    create: {
      email: "coordinator@abbeylegal.com",
      name: "Key Coordinator",
      passwordHash: kcPassword,
      role: Role.KEY_COORDINATOR,
    },
  });
  console.log(`  Key Coordinator: ${keyCoordinator.email} (password: coord123)`);

  // Create sample Sales user
  const salesPassword = await bcrypt.hash("sales123", 12);
  const salesUser = await prisma.user.upsert({
    where: { email: "sales@abbeylegal.com" },
    update: {},
    create: {
      email: "sales@abbeylegal.com",
      name: "Sarah Sales",
      passwordHash: salesPassword,
      role: Role.SALES,
    },
  });
  console.log(`  Sales: ${salesUser.email} (password: sales123)`);

  // Create sample Admin user
  const adminPassword = await bcrypt.hash("ops123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "ops@abbeylegal.com" },
    update: {},
    create: {
      email: "ops@abbeylegal.com",
      name: "Omar Operations",
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });
  console.log(`  Admin: ${adminUser.email} (password: ops123)`);

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
