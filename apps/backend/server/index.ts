import dotenv from "dotenv";
import { resolve } from "node:path";
import app, { prisma } from "./app";

dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "../..", ".env") });

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => console.info(`CookWhat API listening on port ${port}`));

function shutdown() {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
