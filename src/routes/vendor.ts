import bcrypt from "bcrypt";
import User from "../models/user";
import Restaurant from "../models/restaurant";
import authUser from "../middleware/authUser";
import { setCookie, deleteFields } from "../utils";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Register a vendor and a restaurant
router.post("/register", async (req: Request, res: Response) => {
  // Get data from req body
  const { name, email, password, restaurantName, restaurantAddress } = req.body;

  // If a value isn't provided
  if (!name || !email || !password || !restaurantName || !restaurantAddress) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Check if vendor exists
  const vendorExists = await User.findOne({ email }).lean();

  // Throw error if vendor already exists
  if (vendorExists) {
    res.status(400);
    throw new Error("Vendor already exists");
  }

  // Create the restaurant
  const restaurant = await Restaurant.create({
    name: restaurantName,
    address: restaurantAddress,
  });

  // If restaurant is created successfully
  if (restaurant) {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create vendor and populate the restaurant
    const vendor = (
      await (
        await User.create({
          name,
          email,
          role: "VENDOR",
          status: "PENDING",
          password: hashedPassword,
          restaurant: restaurant.id,
        })
      ).populate("restaurant", "-__v -createdAt -updatedAt")
    ).toObject();

    // If vendor is created successfully
    if (vendor) {
      // Generate jwt token and set
      // cookie to the response header
      setCookie(res, vendor._id);

      // Delete fields
      deleteFields(vendor, ["createdAt", "password"]);

      // Send the vendor with response
      res.status(200).json(vendor);
    } else {
      // If vendor isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If restaurant isn't created successfully
    res.status(500);
    throw new Error("Something went wrong");
  }
});

// Add a vendor and a restaurant
router.post("/add", authUser, async (req: Request, res: Response) => {
  // Destructure data from req
  const {
    name,
    email,
    password,
    city,
    state,
    zip,
    confirmPassword,
    restaurantName,
    address_line_1,
    address_line_2,
  } = req.body;

  // If a value isn't provided
  if (
    !name ||
    !email ||
    !password ||
    !city ||
    !state ||
    !zip ||
    !confirmPassword ||
    !restaurantName ||
    !address_line_1 ||
    !address_line_2
  ) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      // Check if vendor exists
      const vendorExists = await User.findOne({ email }).lean();

      // Throw error if vendor already exists
      if (vendorExists) {
        res.status(400);
        throw new Error("Vendor already exists");
      }

      // Create the restaurant
      const restaurant = await Restaurant.create({
        name: restaurantName,
        address: `${address_line_1}, ${address_line_2}, ${city}, ${state} ${zip}`,
      });

      // If restaurant is created successfully
      if (restaurant) {
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create vendor and populate the restaurant
        const vendor = (
          await (
            await User.create({
              name,
              email,
              role: "VENDOR",
              status: "PENDING",
              password: hashedPassword,
              restaurant: restaurant.id,
            })
          ).populate("restaurant", "-__v -updatedAt")
        ).toObject();

        // If vendor is created successfully
        if (vendor) {
          // Delete fields
          deleteFields(vendor, ["createdAt", "password"]);

          // Return the vendor
          res.status(200).json(vendor);
        } else {
          // If vendor isn't created successfully
          res.status(500);
          throw new Error("Something went wrong");
        }
      } else {
        // If restaurant isn't created successfully
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

// Get all the vendors
router.get("/:limit", authUser, async (req: Request, res: Response) => {
  // Get the role from req
  const { limit } = req.params;

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      // Fetch 20 latest vendors with restaurant data
      const vendors = await User.find({ role: "VENDOR" })
        .limit(+limit)
        .select("-__v -password -createdAt -updatedAt")
        .sort({ createdAt: -1 })
        .populate("restaurant", "-__v -updatedAt");

      // If vendors are fetched successfully
      if (vendors) {
        // Return the vendors
        res.status(200).json(vendors);
      } else {
        // If vendors are not fetched successfully
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

// Update vendor status
router.put(
  "/:vendorId/status",
  authUser,
  async (req: Request, res: Response) => {
    // Get the role from req
    const { action } = req.body;
    const { vendorId } = req.params;

    // If action or restaurant id aren't provided
    if (!action) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        // Find the restaurant and update the status
        const updatedVendor = await User.findByIdAndUpdate(
          vendorId,
          {
            status: action === "Approve" ? "APPROVED" : "PENDING",
          },
          {
            returnDocument: "after",
          }
        )
          .select("-__v -password -updatedAt")
          .lean();

        // If status is updated successfully
        if (updatedVendor) {
          // Return the updated restaurant
          res.status(200).json(updatedVendor);
        } else {
          // If status isn't updated successfully
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
  }
);

export default router;
