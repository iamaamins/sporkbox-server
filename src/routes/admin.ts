import express from "express";
import bcrypt from "bcrypt";
import Admin from "../models/admin";
import { serialize } from "cookie";
import generateToken from "../utils";
import adminAuth from "../middleware/adminAuth";

// Initialize router
const router = express.Router();

// Admin login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // If a value isn't provided
  if (!email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Find the admin
  const admin = await Admin.findOne({ email });

  // If admin exists and password matches
  if (admin && (await bcrypt.compare(password, admin.password))) {
    // Generate token
    const jwtToken = generateToken(admin.id);

    res.setHeader(
      "Set-Cookie",
      serialize("token", jwtToken, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 1 week
        sameSite: "strict",
        secure: process.env.NODE_ENV !== "development",
      })
    );

    // Send admin data with the response
    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });
  } else {
    // If admin doesn't exist or password doesn't match
    res.status(400);
    throw new Error("Invalid credentials");
  }
});

router.get("/me", adminAuth, (req, res) => {
  res.json({ mes: "Success" });
});

export default router;
