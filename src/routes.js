import { Router } from "express";
import multer from "multer";
import multerConfig from "./config/multer.js";
import File from "./models/File.js";

const routes = Router();

routes.get("/files", async (req, res) => {
  const files = await File.find();

  return res.json(files);
});

routes.post("/files", multer(multerConfig).single("file"), async (req, res) => {
  const { originalname: name, size, key, location: url = "" } = req.file;

  const file = await File.create({
    name,
    size,
    key,
    url,
  });
  return res.json(file);
});

routes.delete("/files/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    const file = await File.findByIdAndDelete(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default routes;
