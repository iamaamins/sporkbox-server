import bcrypt from "bcrypt";
import User from "../models/user";
import Company from "../models/company";
import { setCookie, deleteFields } from "../utils";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Register customer
router.post("/register", async (req: Request, res: Response) => {
  // Destructure data from req
  const { name, email, password } = req.body;

  // If a value isn't provided
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Get company code from customer's email
  const companyCode = email.split("@")[1].split(".")[0];

  // Check if company exists
  const company = await Company.findOne({ code: companyCode }).lean();

  // If company doesn't exist
  if (!company) {
    res.status(400);
    throw new Error("Your company isn't registered");
  }

  // Check if customer exists
  const customerExists = await User.findOne({ email }).lean();

  // If customer exists
  if (customerExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create customer and populate the company
  const customer = (
    await (
      await User.create({
        name,
        email,
        role: "CUSTOMER",
        company: company._id,
        password: hashedPassword,
      })
    ).populate("company", "-__v -updatedAt")
  ).toObject();

  // If customer is created successfully
  if (customer) {
    // Generate jwt token and set
    // cookie to the response header
    setCookie(res, customer._id);

    // Delete fields
    deleteFields(customer, ["createdAt", "password"]);

    // Send the data with response
    res.status(201).json(customer);
  } else {
    // If customer isn't created successfully
    res.status(500);
    throw new Error("Something went wrong");
  }
});

export default router;
