import bcrypt from "bcrypt";
import mail from "@sendgrid/mail";
import User from "../models/user";
import authUser from "../middleware/authUser";
import jwt, { JwtPayload } from "jsonwebtoken";
import { setCookie, deleteFields } from "../utils";
import express, { Request, Response } from "express";
import { IResetPasswordPayload } from "./../types/index.d";
import { passwordResetTemplate } from "../utils/emailTemplates";
import { IForgotPasswordPayload, ILoginPayload } from "../types";

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

// Forgot password
router.post("/forgot-password", async (req: Request, res: Response) => {
  // Destructure data from req
  const { email }: IForgotPasswordPayload = req.body;

  // If no email is provided
  if (!email) {
    res.status(400);
    throw new Error("Please provide a valid email");
  }

  try {
    // Find the user
    const user = await User.findOne({ email }).orFail();

    // Create jwt token
    const token = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    // Create password reset link
    const link = `${process.env.ROOT_DOMAIN}/reset-password/${user._id}/${token}`;

    try {
      // Email user the password reset link
      await mail.send(passwordResetTemplate(user.toObject(), link));

      // Send the response
      res.status(200).json("Password reset details sent to your email");
    } catch (err) {
      // If email send fails
      throw err;
    }
  } catch (err) {
    // If no user is found
    throw err;
  }
});

// Reset password
router.patch("/reset-password/:token", async (req: Request, res: Response) => {
  // Destructure data from req
  const { token } = req.params;
  const { password }: IResetPasswordPayload = req.body;

  // If all the fields aren't provided
  if (!password || !token) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  try {
    // Decode the token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    try {
      // Create salt
      const salt = await bcrypt.genSalt(10);

      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, salt);

        try {
          // Find the user update the user
          await User.findOneAndUpdate(
            { _id: decoded._id },
            {
              password: hashedPassword,
            }
          )
            .lean()
            .orFail();

          // Send the response
          res.status(201).json("Password reset successful");
        } catch (err) {
          // If user isn't found
          throw err;
        }
      } catch (err) {
        // If password isn't hashed
        throw err;
      }
    } catch (err) {
      // If failed to create salt
      throw err;
    }
  } catch (err) {
    // If token is invalid or expired
    throw err;
  }
});

export default router;
