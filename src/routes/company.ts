import Company from "../models/company";
import { deleteFields } from "../utils";
import authUser from "../middleware/authUser";
import { ICompanyPayload } from "../types";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Add a company
router.post("/add", authUser, async (req: Request, res: Response) => {
  // Destructure body data
  const {
    name,
    code,
    city,
    state,
    zip,
    website,
    dailyBudget,
    addressLine1,
    addressLine2,
  }: ICompanyPayload = req.body;

  // If all the fields aren't provided
  if (
    !name ||
    !code ||
    !city ||
    !state ||
    !zip ||
    !website ||
    !dailyBudget ||
    !addressLine1 ||
    !addressLine2
  ) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  // Check if there is a company already
  const company = await Company.findOne({ code }).lean();

  // If a company exists
  if (company) {
    res.status(401);
    throw new Error("A company with the same code already exists");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      try {
        // Create a new company
        const company = (
          await Company.create({
            name,
            code,
            website,
            dailyBudget,
            status: "ACTIVE",
            address: `${addressLine1}, ${addressLine2}, ${city}, ${state} ${zip}`,
          })
        ).toObject();

        // Delete fields
        deleteFields(company);

        // Send the company with response
        res.status(201).json(company);
      } catch (err) {
        // If company isn't created successfully
        res.status(500);
        throw new Error("Failed to create company");
      }
    } else {
      // If role isn't admin
      res.status(401);
      throw new Error("Not authorized");
    }
  } else {
    // If there is no user
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get all companies
router.get("/", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      try {
        // Create a new company
        const companies = await Company.find()
          .select("-__v -updatedAt")
          .sort({ createdAt: -1 });

        // Send the companies with response
        res.status(201).json(companies);
      } catch (err) {
        // If companies aren't fetched successfully
        res.status(500);
        throw new Error("Failed to fetch companies");
      }
    } else {
      // If role isn't admin
      res.status(401);
      throw new Error("Not authorized");
    }
  } else {
    // If there is no user
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Edit a company
router.put(
  "/:companyId/update",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { companyId } = req.params;
    const {
      name,
      code,
      city,
      state,
      zip,
      website,
      dailyBudget,
      addressLine1,
      addressLine2,
    }: ICompanyPayload = req.body;

    // If all the fields aren't provided
    if (
      !companyId ||
      !name ||
      !code ||
      !city ||
      !state ||
      !zip ||
      !website ||
      !dailyBudget ||
      !addressLine1 ||
      !addressLine2
    ) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        try {
          // Find and update the company
          const updatedCompany = await Company.findByIdAndUpdate(
            companyId,
            {
              name,
              website,
              code,
              dailyBudget,
              address: `${addressLine1}, ${addressLine2}, ${city}, ${state} ${zip}`,
            },
            { returnDocument: "after" }
          ).lean();

          // If company is updated successfully
          if (updatedCompany) {
            // Delete fields
            deleteFields(updatedCompany);

            // Send the updated company with response
            res.status(201).json(updatedCompany);
          }
        } catch (err) {
          // If company isn't updated successfully
          res.status(500);
          throw new Error("Failed to update company");
        }
      } else {
        // If role isn't admin
        res.status(401);
        throw new Error("Not authorized");
      }
    } else {
      // If there is no user
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

// Update company status
router.put(
  "/:companyId/status",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { companyId } = req.params;
    const { action } = req.body;

    // If all the fields aren't provided
    if (!companyId || !action) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        try {
          // Find and update company status
          const updatedCompany = await Company.findByIdAndUpdate(
            companyId,
            {
              status: action === "Archive" ? "ARCHIVED" : "ACTIVE",
            },
            { returnDocument: "after" }
          )
            .select("-__v -updatedAt")
            .lean();

          // Send data with response
          res.status(200).json(updatedCompany);
        } catch (err) {
          // If company status isn't updated successfully
          res.status(500);
          throw new Error("Failed to update company status");
        }
      } else {
        // If role isn't admin
        res.status(401);
        throw new Error("Not authorized");
      }
    } else {
      // If there is no user
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

export default router;
