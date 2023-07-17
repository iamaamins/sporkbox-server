import bcrypt from "bcrypt";
import User from "../models/user";
import Company from "../models/company";
import authUser from "../middleware/authUser";
import { setCookie, deleteFields, checkActions, checkShift } from "../utils";
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
      // Log error
      console.log("Please provide all the fields");

      res.status(400);
      throw new Error("Please provide all the fields");
    }

    try {
      // Get the companies with provided code
      const companies = await Company.find({
        code: companyCode,
      })
        .select("-updatedAt -createdAt -website")
        .lean()
        .orFail();

      // Change all companies status archived
      const archivedCompanies = companies.map((company) => ({
        ...company,
        status: "ARCHIVED",
      }));

      // Get shifts of the active companies
      const shifts = companies
        .filter((company) => company.status === "ACTIVE")
        .map((activeCompany) => activeCompany.shift);

      try {
        // Create salt
        const salt = await bcrypt.genSalt(10);

        try {
          // Hash password
          const hashedPassword = await bcrypt.hash(password, salt);

          try {
            // Create customer and populate the company
            const response = await User.create({
              firstName,
              lastName,
              email,
              shifts,
              status: "ACTIVE",
              role: "CUSTOMER",
              password: hashedPassword,
              companies: archivedCompanies,
            });

            // Convert BSON to object
            const customer = response.toObject();

            // Generate jwt token and set
            // cookie to the response header
            setCookie(res, customer._id);

            // Delete fields
            deleteFields(customer, ["createdAt", "password"]);

            // Send the data with response
            res.status(201).json(customer);
          } catch (err) {
            // If user isn't created
            console.log(err);

            throw err;
          }
        } catch (err) {
          // If password hash isn't created
          console.log(err);

          throw err;
        }
      } catch (err) {
        // If salt isn't created
        console.log(err);

        throw err;
      }
    } catch (err) {
      // If company doesn't exist
      console.log(err);

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
        const customers = await User.find({ role: "CUSTOMER" }).select(
          "-__v -updatedAt -password -role"
        );

        // Send the customers data with response
        res.status(200).json(customers);
      } catch (err) {
        // If customers aren't fetched successfully
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't admin
      console.log("Not authorized");

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
          // Log error
          console.log("Please provide all the fields");

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
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin
        console.log("Not authorized");

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
          // Log error
          console.log("Please provide all the fields");

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
            .lean()
            .orFail();

          // Send the updated customer data with response
          res.status(201).json(updatedCustomer);
        } catch (err) {
          // If customer isn't updated successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't customer
        console.log("Not authorized");

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
        const { shift }: IShiftChangePayload = req.body;

        // If no shift is provided
        if (!shift || typeof shift !== "string") {
          // Log error
          console.log("Please provide a valid shift");

          res.status(400);
          throw new Error("Please provide a valid shift");
        }

        // Check provided shifts validity
        checkShift(res, shift);

        try {
          try {
            // Get all the companies
            const response = await Company.find({
              code: companyCode,
            })
              .select("-__v -updatedAt -createdAt -website")
              .lean()
              .orFail();

            // Get active companies
            const activeCompanies = response.filter(
              (company) => company.status === "ACTIVE"
            );

            // If provided shift doesn't exist in active companies
            if (
              !activeCompanies.some(
                (activeCompany) => activeCompany.shift === shift
              )
            ) {
              // Log error
              console.log("Please provide a valid shift");

              res.status(404);
              throw new Error("Please provide a valid shift");
            }

            // Change active company status
            // to archive if the shift of the company
            // doesn't match with one of the provided shifts
            const updatedCompanies = activeCompanies.map((company) =>
              company.shift === shift
                ? company
                : { ...company, status: "ARCHIVED" }
            );

            // Get inactive companies
            const archivedCompanies = response.filter(
              (company) => company.status !== "ACTIVE"
            );

            // Create all companies
            const companies = [...archivedCompanies, ...updatedCompanies];

            try {
              // Update the customer
              await User.findByIdAndUpdate(
                { _id: customerId },
                { $set: { companies: companies } }
              ).orFail();

              // Send the companies
              res.status(201).json(companies);
            } catch (err) {
              // If user isn't updated successfully
              console.log(err);

              throw err;
            }
          } catch (err) {
            // If companies aren't fetched successfully
            console.log(err);

            throw err;
          }
        } catch (err) {
          // If orders aren't fetched successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't customer
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

export default router;
