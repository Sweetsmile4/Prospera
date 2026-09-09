import dns from "node:dns";
import dotenv from "dotenv";
import app from "./app";
import { connectDatabase } from "./config/database";
import { ensureDefaultCategories } from "./services/categories";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();
  await ensureDefaultCategories();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
