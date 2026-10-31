import { prisma } from "../lib/db";
import { seedWave1 } from "../lib/seed-wave1";

seedWave1()
  .then((counts) => {
    console.log("seeded TYSM wave1", counts);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
