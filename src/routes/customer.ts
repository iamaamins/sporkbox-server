import bcrypt from "bcrypt";
import User from "../models/user";
import Company from "../models/company";
import { ICustomerPayload } from "../types";
import { setCookie, deleteFields } from "../utils";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Register customer
router.post("/register", async (req: Request, res: Response) => {
  // Destructure data from req
  const { firstName, lastName, email, password }: ICustomerPayload = req.body;

  // If a value isn't provided
  if (!firstName || !lastName || !email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Get company code from customer's email
  const companyCode = email.split("@")[1].split(".")[0];

  try {
    // Check if company exists
    const company = await Company.findOne({ code: companyCode }).lean();

    // If company doesn't exist
    if (!company) {
      res.status(400);
      throw new Error("Your company isn't registered");
    }

    try {
      // Check if customer exists
      const customerExists = await User.findOne({ email }).lean();

      // If customer exists
      if (customerExists) {
        res.status(400);
        throw new Error("User already exists");
      }

      try {
        // Create salt
        const salt = await bcrypt.genSalt(10);

        try {
          // Hash password
          const hashedPassword = await bcrypt.hash(password, salt);

          try {
            // Create customer and populate the company
            const customer = (
              await (
                await User.create({
                  firstName,
                  lastName,
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
            }
          } catch (err) {
            // If user isn't created successfully
            res.status(500);
            throw new Error("Failed to create user");
          }
        } catch (err) {
          // If password has isn't create successfully
          res.status(500);
          throw new Error("Failed to create password hash");
        }
      } catch (err) {
        // If salt isn't create successfully
        res.status(500);
        throw new Error("Failed to create salt");
      }
    } catch (err) {
      // If user isn't fetched successfully
      res.status(500);
      throw new Error("Failed to fetch user");
    }
  } catch (err) {
    // If company isn't fetched successfully
    res.status(500);
    throw new Error("Failed to fetch company");
  }
});

export default router;
