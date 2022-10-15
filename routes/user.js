const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const authUser = require("../middleware/authUser");
const { setCookie, deleteFields } = require("../utils");

// Initialize router
const router = express.Router();

// user login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // If a value isn't provided
  if (!email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Find the user
  const user = (await User.findOne({ email })).toObject();

  // If user exists and password matches
  if (user && (await bcrypt.compare(password, user.password))) {
    // Generate jwt token and set
    // cookie to the response header
    setCookie(res, user);

    // Delete fields
    deleteFields(user, ["password", "createdAt"]);
    // console.log(user);

    // Send user data with the response
    res.status(200).json(user);
  } else {
    // If user doesn't exist or password doesn't match
    res.status(401);
    throw new Error("Invalid credentials");
  }
});

// Log out user
router.post("/logout", async (req, res) => {
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

router.get("/me", authUser, async (req, res) => {
  // Destructure user
  const { id, role } = req.user;

  // If role is customer
  if (role === "CUSTOMER") {
    // Find the customer and populate the company
    const customer = await User.findById(id)
      .select("-__v -password -createdAt -updatedAt")
      .populate("company", "-__v -updatedAt");

    // If customer is found successfully
    if (customer) {
      res.status(200).json(customer);
    } else {
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else if (role === "ADMIN" || role === "VENDOR") {
    // Simply return the user
    res.status(200).json(req.user);
  } else {
    // If role isn't customer
    res.status(401);
    throw new Error("Not authorized");
  }
});

module.exports = router;
