import Company from "../models/company";
import { deleteFields } from "../utils";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Add a company
router.post("/add", authUser, async (req: Request, res: Response) => {
  const { name, website, address, code, dailyBudget } = req.body;

  // If all the fields aren't provided
  if (!name || !website || !address || !code || !dailyBudget) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      // Create a new company
      const company = (
        await Company.create({
          name,
          website,
          address,
          code,
          dailyBudget,
        })
      ).toObject();

      // If company is created successfully
      if (company) {
        // Delete fields
        deleteFields(company);

        // // Send the company with response
        res.status(201).json(company);
      } else {
        // If company isn't created successfully
        res.status(500);
        throw new Error("Something went wrong");
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
      // Create a new company
      const companies = await Company.find()
        .select("-__v -updatedAt")
        .sort({ createdAt: -1 });

      // If companies are found successfully
      if (companies) {
        // Send the companies with response
        res.status(201).json(companies);
      } else {
        // If companies aren't found successfully
        res.status(500);
        throw new Error("Something went wrong");
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

// Delete a company
router.delete("/:companyId", authUser, async (req: Request, res: Response) => {
  // Destructure data from req
  const { companyId } = req.params;

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      // Find and delete the company
      const deleted = await Company.findByIdAndDelete(companyId);

      // If is successfully deleted
      if (deleted) {
        // Send data with response
        res.status(200).json({ message: "Successfully deleted" });
      } else {
        // If is not deleted successfully
        res.status(500);
        throw new Error("Something went wrong");
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

export default router;
