import bcrypt from "bcrypt";
import User from "../models/user";
import { ILoginPayload } from "../types";
import authUser from "../middleware/authUser";
import { setCookie, deleteFields } from "../utils";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// user login
router.post("/login", async (req: Request, res: Response) => {
  // Destructure data from req
  const { email, password }: ILoginPayload = req.body;

  // If a value isn't provided
  if (!email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  try {
    // Find the user
    const user = await User.findOne({ email })
      // .populate(
      //   "restaurant",
      //   "-__v -updatedAt -createdAt"
      // )
      .populate("company", "-__v -updatedAt -createdAt -code -website")
      .lean()
      .orFail();

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
      // If user isn't found
      res.status(400);
      throw new Error("Invalid credentials");
    }
  } catch (err) {
    // If user isn't found
    res.status(400);
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
      maxAge: 0,
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
    })
    .end();
});

// Get user details
router.get("/me", authUser, async (req: Request, res: Response) => {
  // Send the user with response
  res.status(200).json(req.user);
});

export default router;
