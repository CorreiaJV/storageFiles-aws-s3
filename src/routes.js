import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import multer from "multer";
import multerConfig from "./config/multer.js";
import File from "./models/File.js";
import User from "./models/User.js";

const routes = Router();

//User Routes

routes.post("/auth/register", async (req, res) => {
  const { name, email, password, confirmpassword } = req.body;

  // Validation of body fields
  if (!name || !email || !password || !confirmpassword) {
    return res.status(422).json({ error: "All fields are needed" });
  }

  if (password != confirmpassword) {
    return res.status(422).json({ error: "Passwords did not match" });
  }
  // Check if user exists
  const userExists = await User.findOne({ email: email });

  if (userExists) {
    return res.status(409).json({ error: "E-mail already in use" });
  }

  // Create password
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = new User({
    name,
    email,
    password: passwordHash,
  });
  try {
    await user.save();
    return res.status(201).json({ message: "User created sucessfully" });
  } catch (error) {
    console.error("Error creating User", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

routes.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({ error: "All fields are needed" });
  }

  const user = await User.findOne({ email: email });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const checkPassword = await bcrypt.compare(password, user.password);

  if (!checkPassword) {
    return res.status(401).json({ error: "Invalid Password" });
  }

  try {
    const secret = process.env.SECRET;
    const expiresInAccessToken = "30m";
    const expiresInRefreshToken = "1d";

    // Access Token
    const accessToken = jwt.sign({ id: user._id }, secret, {
      expiresIn: expiresInAccessToken,
    });

    // Refresh Token
    const refreshToken = jwt.sign({ id: user._id }, secret, {
      expiresIn: expiresInRefreshToken,
    });

    res.status(200).json({ msg: "Login Sucessful", accessToken, refreshToken });
  } catch (error) {
    console.error("Error Login User", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

routes.post("/auth/refreshToken", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ msg: "Refresh Token is required!" });
  }

  try {
    const secret = process.env.SECRET;

    const decoded = jwt.verify(refreshToken, secret);

    const newAccessToken = jwt.sign({ id: decoded.id }, secret, {
      expiresIn: "30m",
    });

    res
      .status(200)
      .json({ msg: "New Access Token generated", accessToken: newAccessToken });
  } catch (error) {
    console.error("Error refreshing token", error);
    return res.status(401).json({ msg: "Invalid Refresh Token!" });
  }
});

routes.get("/user/:id", checkToken, async (req, res) => {
  const id = req.params.id;

  try {
    const user = await User.findById(id, "-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Internal Server Error" });
  }
});

function checkToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ msg: "Access Denied!" });
  }

  try {
    const secret = process.env.SECRET;
    const decoded = jwt.verify(token, secret);

    req.user = { id: decoded.id };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ msg: "Token expired!" });
    } else {
      return res.status(400).json({ msg: "Invalid Token!" });
    }
  }
}

// Files Routes with user

routes.post(
  "/files",
  checkToken,
  multer(multerConfig).single("file"),
  async (req, res) => {
    const { originalname: name, size, key, location: url = "" } = req.file;

    try {
      const userId = req.user.id;

      const existingFile = await File.findOne({ user: userId });

      if (existingFile) {
        return res
          .status(400)
          .json({ error: "User already has a file associated" });
      }

      const file = await File.create({
        name,
        size,
        key,
        url,
        user: userId,
      });

      return res.status(201).json({ msg: "File Uploaded!", file });
    } catch (error) {
      console.error("Error creating file:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

routes.get("/files", checkToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userFile = await File.findOne({ user: userId }).populate("user", [
      "name",
      "email",
    ]);

    return res.json(userFile);
  } catch (error) {
    console.error("Error getting user file:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

routes.delete("/files/:fileId", checkToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const fileId = req.params.fileId;

    const file = await File.findOne({ _id: fileId, user: userId });

    if (!file) {
      return res
        .status(404)
        .json({ error: "File not found or does not belong to the user" });
    }

    // Delete File
    await File.findByIdAndDelete(fileId);

    return res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting user file:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update File
routes.put(
  "/files/:fileId",
  checkToken,
  multer(multerConfig).single("file"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const fileId = req.params.fileId;

      const file = await File.findOne({ _id: fileId, user: userId });

      if (!file) {
        return res
          .status(404)
          .json({ error: "File not found or does not belong to the user" });
      }

      const { originalname: name, size, key, location: url = "" } = req.file;

      const updatedFile = await File.findByIdAndUpdate(
        fileId,
        {
          name,
          size,
          key,
          url,
        },
        { new: true }
      );

      return res
        .status(200)
        .json({ message: "File updated successfully", updatedFile });
    } catch (error) {
      console.error("Error updating user file:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default routes;
