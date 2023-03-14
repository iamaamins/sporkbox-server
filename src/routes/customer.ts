import bcrypt from "bcrypt";
import User from "../models/user";
import Company from "../models/company";
import authUser from "../middleware/authUser";
import { setCookie, deleteFields, checkActions } from "../utils";
import express, { NextFunction, Request, Response } from "express";
import {
  ICustomerPayload,
  IEditCustomerPayload,
  IShiftChangePayload,
  IStatusChangePayload,
} from "../types";

// Initialize router
const router = express.Router();

// Register customer
router.post(
  "/register-customer",
  async (req: Request, res: Response, next: NextFunction) => {
    // Destructure data from req
    const {
      firstName,
      lastName,
      email,
      password,
      companyCode,
    }: ICustomerPayload = req.body;

    // If a value isn't provided
    if (!firstName || !lastName || !email || !password) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    try {
      // Get the companies with code
      const companies = await Company.find({ code: companyCode })
        .select("-updatedAt -createdAt -website")
        .lean()
        .orFail();

      // Find the company where the shift is day
      const defaultCompany = companies.find(
        (company) => company.shift === "day"
      );

      // Available shifts
      const shifts = companies.map((company) => company.shift);

      try {
        // Create salt
        const salt = await bcrypt.genSalt(10);

        try {
          // Hash password
          const hashedPassword = await bcrypt.hash(password, salt);

          try {
            // Create customer and populate the company
            const customer = await User.create({
              firstName,
              lastName,
              email,
              shifts,
              status: "ACTIVE",
              role: "CUSTOMER",
              password: hashedPassword,
            });

            try {
              // Add the default company to companies
              await customer.updateOne({
                $push: { companies: defaultCompany },
              });

              // Create customer
              const customerWithCompanies = {
                ...customer.toObject(),
                companies: [defaultCompany],
              };

              // Generate jwt token and set
              // cookie to the response header
              setCookie(res, customerWithCompanies._id);

              // Delete fields
              deleteFields(customer, ["createdAt", "password"]);

              // Send the data with response
              res.status(201).json(customerWithCompanies);
            } catch (err) {
              // If company isn't populated
              throw err;
            }
          } catch (err) {
            // If user isn't created
            throw err;
          }
        } catch (err) {
          // If password hash isn't created
          throw err;
        }
      } catch (err) {
        // If salt isn't created
        throw err;
      }
    } catch (err) {
      // If company doesn't exist
      throw err;
    }
  }
);

// Get all customers
router.get("", authUser, async (req: Request, res: Response) => {
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    if (role === "ADMIN") {
      try {
        // Get all customers
        const customers = await User.find({ role: "CUSTOMER" })
          .select("-__v -updatedAt -password -role")
          .populate("company", "address name");

        // Send the customers data with response
        res.status(200).json(customers);
      } catch (err) {
        // If customers aren't fetched successfully
        throw err;
      }
    } else {
      // If role isn't admin
      res.status(403);
      throw new Error("Not authorized");
    }
  }
});

// Edit customer details
router.patch(
  "/:customerId/update-customer-details",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { customerId } = req.params;
        const { firstName, lastName, email }: IEditCustomerPayload = req.body;

        // If all the fields aren't provided
        if (!customerId || !firstName || !lastName || !email) {
          res.status(400);
          throw new Error("Please provide all the fields");
        }

        try {
          // Get all customers
          const updatedCustomer = await User.findOneAndUpdate(
            { _id: customerId },
            {
              firstName,
              lastName,
              email,
            },
            { returnDocument: "after" }
          )
            .lean()
            .orFail();

          // Send the updated customer data with response
          res.status(200).json(updatedCustomer);
        } catch (err) {
          // If customer isn't updated successfully
          throw err;
        }
      } else {
        // If role isn't admin
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Change customer status
router.patch(
  "/:customerId/change-customer-status",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from request
        const { customerId } = req.params;
        const { action }: IStatusChangePayload = req.body;

        // If all the fields aren't provided
        if (!customerId || !action) {
          res.status(400);
          throw new Error("Please provide all the fields");
        }

        // Check actions validity
        checkActions(undefined, action, res);

        try {
          // Get all customers
          const updatedCustomer = await User.findOneAndUpdate(
            { _id: customerId },
            {
              status: action === "Archive" ? "ARCHIVED" : "ACTIVE",
            },
            { returnDocument: "after" }
          )
            .select("-__v -password -updatedAt -role")
            .populate("company", "name address")
            .lean()
            .orFail();

          // Send the updated customer data with response
          res.status(201).json(updatedCustomer);
        } catch (err) {
          // If customer isn't updated successfully
          throw err;
        }
      } else {
        // If role isn't customer
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Change customer shift
router.patch(
  "/:customerId/:companyCode/change-customer-shift",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "CUSTOMER") {
        // Destructure data from request
        const { customerId, companyCode } = req.params;
        const { shifts }: IShiftChangePayload = req.body;

        try {
          // Get the companies
          const companies = await Company.find({
            code: companyCode,
            shift: { $in: shifts },
          })
            .lean()
            .orFail();

          console.log(companies);

          // try {
          //   // Update the customer
          //   const updatedCustomer = await User.findByIdAndUpdate(
          //     { _id: customerId },
          //     { $set: { companies: companies } }
          //   );

          //   console.log(updatedCustomer);
          // } catch (err) {
          //   throw err;
          // }
        } catch (err) {
          throw err;
        }
      } else {
        // If role isn't customer
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

export default router;
