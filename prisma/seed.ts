import { prisma } from "../lib/db";
import { seedDemo } from "../lib/seed-demo";

seedDemo()
  .then((counts) => {
    console.log("seeded TYSM", counts);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
