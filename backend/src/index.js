import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js";
import userRouter from "./routes/user.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

const { PORT = 4000, MONGO_URI } = process.env;
mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log("API on http://localhost:" + PORT));
  })
  .catch((err) => {
    console.error("Mongo connect error:", err.message);
    process.exit(1);
  });
