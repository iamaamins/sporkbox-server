import bcrypt from "bcrypt";
import User from "../models/user";
import authUser from "../middleware/authUser";
import { setCookie, deleteFields } from "../utils";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// user login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // If a value isn't provided
  if (!email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Find the user
  const user = await User.findOne({ email })
    // .populate(
    //   "restaurant",
    //   "-__v -updatedAt -createdAt"
    // )
    .populate("company", "-__v -updatedAt -createdAt -code -website")
    .lean();

  // If user exists and password matches
  if (user && (await bcrypt.compare(password, user.password))) {
    // Generate jwt token and set
    // cookie to the response header
    setCookie(res, user._id);

    // Delete fields
    deleteFields(user, ["password", "createdAt"]);

    // Send user data with the response
    res.status(200).json(user);
  } else {
    // If user doesn't exist or password doesn't match
    res.status(401);
    throw new Error("Invalid credentials");
  }
});

// Log out user
router.post("/logout", async (req: Request, res: Response) => {
  // Clear cookie
  res
    .clearCookie("token", {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      maxAge: 0,
      secure: process.env.NODE_ENV !== "development",
    })
    .end();
});

router.get("/me", authUser, async (req: Request, res: Response) => {
  // Send the user with response
  res.status(200).json(req.user);
});

export default router;
