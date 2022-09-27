import express from "express";
import bcrypt from "bcrypt";
import Admin from "../models/admin";
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
    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin.id),
    });
  } else {
    // If admin doesn't exist or password doesn't match
    res.status(400);
    throw new Error("Invalid credentials");
  }
});

router.get("/me", adminAuth, (req, res) => {
  res.json(req.admin);
});

export default router;
