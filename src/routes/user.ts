import bcrypt from "bcrypt";
import mail from "@sendgrid/mail";
import jwt from "jsonwebtoken";
import User from "../models/user";
import authUser from "../middleware/authUser";
import { setCookie, deleteFields } from "../utils";
import express, { Request, Response } from "express";
import { IResetPasswordPayload } from "./../types/index.d";
import {
  passwordResetConfirmationTemplate,
  passwordResetTemplate,
} from "../utils/emailTemplates";
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
    const user = await User.findOne({ email }).lean().orFail();

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
      path: "/",
      maxAge: 0,
      httpOnly: true,
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

    //  Create unique jwt secret
    const jwtSecret = process.env.JWT_SECRET + user.password;

    // Create jwt token
    const token = jwt.sign({ _id: user._id }, jwtSecret, { expiresIn: "15m" });

    // Create password reset link
    const link = `${process.env.CLIENT_URL}/reset-password/${user._id}/${token}`;

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
router.patch(
  "/reset-password/:userId/:token",
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { userId, token } = req.params;
    const { password }: IResetPasswordPayload = req.body;

    // If all the fields aren't provided
    if (!password || !userId || !token) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    try {
      // Find the user
      const user = await User.findById(userId).orFail();

      // Create the secret
      const jwtSecret = process.env.JWT_SECRET + user.password;

      try {
        // Verify the token
        jwt.verify(token, jwtSecret);

        try {
          // Create salt
          const salt = await bcrypt.genSalt(10);

          try {
            // Hash password
            const hashedPassword = await bcrypt.hash(password, salt);

            try {
              // Find the user update the user
              await User.findOneAndUpdate(
                { _id: userId },
                {
                  password: hashedPassword,
                }
              ).orFail();

              try {
                // Email user
                await mail.send(
                  passwordResetConfirmationTemplate(user.toObject())
                );

                // Send the response
                res.status(201).json("Password reset successful");
              } catch (err) {
                // If email isn't sent
                throw err;
              }
            } catch (err) {
              // If user isn't updated
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
        // If token in invalid or expired
        throw err;
      }
    } catch (err) {
      // If user isn't found
      throw err;
    }
  }
);

export default router;
