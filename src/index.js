import express from "express";
import morgan from "morgan";
import cors from "cors"; // Import the cors middleware
import routes from "./routes.js";
import mongoose from "mongoose";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Database setup
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("common", {
    stream: fs.createWriteStream("./access.log", { flags: "a" }),
  })
);
app.use(morgan("dev"));

app.use(cors());

app.use(routes);

app.use(
  "/files",
  express.static(path.resolve(__dirname, "..", "tmp", "uploads"))
);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
