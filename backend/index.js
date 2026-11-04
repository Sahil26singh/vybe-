import "dotenv/config";
import connectDB from "./utils/db.js";
import { app, server } from "./app.js";

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await connectDB(); 
    server.listen(PORT, () => {
      console.log(`Server is listening at port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
