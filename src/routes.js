import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import multer from "multer";
import multerConfig from "./config/multer.js";
import File from "./models/File.js";
import User from "./models/User.js";

const routes = Router();

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

//User Routes

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: ['User routes']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmpassword:
 *                 type: string
 *     responses:
 *       '201':
 *         description: User created successfully
 *       '422':
 *         description: Validation error or passwords did not match
 *       '409':
 *         description: E-mail already in use
 *       '500':
 *         description: Internal Server Error
 */
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

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with existing credentials
 *     tags: ['User routes']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             example:
 *               msg: "Login Successful"
 *               accessToken: "..."
 *               refreshToken: "..."
 *       '401':
 *         description: Invalid Password
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal Server Error
 */
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

/**
 * @swagger
 * /auth/refreshToken:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: ['User routes']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       '200':
 *         description: New Access Token generated
 *         content:
 *           application/json:
 *             example:
 *               msg: "New Access Token generated"
 *               accessToken: "..."
 *       '401':
 *         description: Invalid Refresh Token
 *       '500':
 *         description: Internal Server Error
 */
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

/**
 * @swagger
 * /user/{id}:
 *   get:
 *     summary: Get user details by ID
 *     tags: ['User routes']
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               user: { /* user object /* }
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal Server Error
 */
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

/**
 * @swagger
 * /user:
 *   put:
 *     summary: Update user details
 *     tags: ['User routes']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: User updated successfully
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal Server Error
 */
routes.put("/user-update", checkToken, async (req, res) => {
  const userId = req.user.id;
  const { name, password } = req.body;

  try {
    const updateFields = {};
    if (name) {
      updateFields.name = name;
    }

    if (password) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      updateFields.password = passwordHash;
    }
    console.log(updateFields);
    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ msg: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Files Routes with user
/**
 * @swagger
 * /files:
 *   post:
 *     summary: Upload a file
 *     tags: ['File routes']
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '201':
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             example:
 *               msg: "File Uploaded!"
 *               file: { /* file object /* }
 *       '400':
 *         description: User already has a file associated
 *       '500':
 *         description: Internal Server Error
 */
routes.post(
  "/files",
  checkToken,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const existingFile = await File.findOne({ user: userId });

      if (existingFile) {
        return res
          .status(400)
          .json({ error: "User already has a file associated" });
      }

      next();
    } catch (error) {
      console.error("Error checking existing file:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
  multer(multerConfig).single("file"),
  async (req, res) => {
    const { originalname: name, size, key, location: url = "" } = req.file;

    try {
      const userId = req.user.id;

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

/**
 * @swagger
 * /files:
 *   get:
 *     summary: Get the user's file
 *     tags: ['File routes']
 *     responses:
 *       '200':
 *         description: User's file retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               name: "example.txt"
 *               size: 1024
 *               key: "file-key"
 *               url: "file-url"
 *               user: { /* user object /* }
 *       '500':
 *         description: Internal Server Error
 */
routes.get("/files", checkToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userFile = await File.findOne({ user: userId }).populate(
      "user",
      "-_id -password"
    );

    return res.status(200).json(userFile);
  } catch (error) {
    console.error("Error getting user file:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /files/{fileId}:
 *   delete:
 *     summary: Delete a file
 *     tags: ['File routes']
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         description: ID of the file to delete
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: File deleted successfully
 *       '404':
 *         description: File not found or does not belong to the user
 *       '500':
 *         description: Internal Server Error
 */
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

/**
 * @swagger
 * /files/{fileId}:
 *   put:
 *     summary: Update a file
 *     tags: ['File routes']
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         description: ID of the file to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: File updated successfully
 *         content:
 *           application/json:
 *             example:
 *               message: "File updated successfully"
 *               updatedFile: { /* updated file object /* }
 *       '404':
 *         description: File not found or does not belong to the user
 *       '500':
 *         description: Internal Server Error
 */
routes.put(
  "/files/:fileId",
  checkToken,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const fileId = req.params.fileId;

      const file = await File.findOne({ _id: fileId, user: userId });

      if (!file) {
        return res
          .status(404)
          .json({ error: "File not found or does not belong to the user" });
      }

      next();
    } catch (error) {
      console.error("Error checking existing file:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
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
