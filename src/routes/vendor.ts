import bcrypt from "bcrypt";
import User from "../models/user";
import Restaurant from "../models/restaurant";
import authUser from "../middleware/authUser";
import { setCookie, deleteFields, checkActions } from "../utils";
import express, { Request, Response } from "express";
import { IVendorPayload, IVendorStatusPayload } from "../types";

// Initialize router
const router = express.Router();

// Register a vendor and a restaurant
router.post("/register-vendor", async (req: Request, res: Response) => {
  // Destructure data from req
  const {
    firstName,
    lastName,
    email,
    password,
    city,
    state,
    zip,
    restaurantName,
    addressLine1,
    addressLine2,
  }: IVendorPayload = req.body;

  // If a value isn't provided
  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !city ||
    !state ||
    !zip ||
    !restaurantName ||
    !addressLine1 ||
    !addressLine2
  ) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  try {
    // Check if vendor exists
    const vendorExists = await User.findOne({ email }).lean();

    // Throw error if vendor already exists
    if (vendorExists) {
      res.status(400);
      throw new Error("Vendor already exists");
    }

    try {
      // Create the restaurant
      const restaurant = await Restaurant.create({
        name: restaurantName,
        address: `${addressLine1}, ${addressLine2}, ${city}, ${state} ${zip}`,
      });

      // If restaurant is created successfully
      if (restaurant) {
        try {
          // Create salt
          const salt = await bcrypt.genSalt(10);

          try {
            // Hash password
            const hashedPassword = await bcrypt.hash(password, salt);

            try {
              // Create vendor
              const response = await User.create({
                firstName,
                lastName,
                email,
                role: "VENDOR",
                status: "ARCHIVED",
                password: hashedPassword,
                restaurant: restaurant.id,
              });

              try {
                // Populate restaurant
                const vendorWithRestaurant = await response.populate(
                  "restaurant",
                  "-__v -createdAt -updatedAt"
                );

                // If vendor is created successfully
                if (vendorWithRestaurant) {
                  // Create vendor object
                  const vendor = vendorWithRestaurant.toObject();

                  // Generate jwt token and set
                  // cookie to the response header
                  setCookie(res, vendor._id);

                  // Delete fields
                  deleteFields(vendor, ["createdAt", "password"]);

                  // Send the vendor with response
                  res.status(200).json(vendor);
                }
              } catch (err) {
                // If failed to populate restaurant
                throw err;
              }
            } catch (err) {
              // If vendor isn't created successfully
              throw err;
            }
          } catch (err) {
            // If password hashing isn't  successful
            res.status(500);
            throw new Error("Failed to hash password");
          }
        } catch (err) {
          // If salt isn't created successfully
          res.status(500);
          throw new Error("Failed to create slat");
        }
      }
    } catch (err) {
      // If restaurant isn't created successfully
      throw err;
    }
  } catch (err) {
    // If vendor isn't found
    throw err;
  }
});

// Add a vendor and a restaurant
router.post("/add-vendor", authUser, async (req: Request, res: Response) => {
  // Destructure data from req
  const {
    firstName,
    lastName,
    email,
    password,
    city,
    state,
    zip,
    restaurantName,
    addressLine1,
    addressLine2,
  }: IVendorPayload = req.body;

  // If a value isn't provided
  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !city ||
    !state ||
    !zip ||
    !restaurantName ||
    !addressLine1 ||
    !addressLine2
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
      try {
        // Check if vendor exists
        const vendorExists = await User.findOne({ email }).lean();

        // Throw error if vendor already exists
        if (vendorExists) {
          res.status(400);
          throw new Error("Vendor already exists");
        }

        try {
          // Create the restaurant
          const restaurant = await Restaurant.create({
            name: restaurantName,
            address: `${addressLine1}, ${addressLine2}, ${city}, ${state} ${zip}`,
          });

          // If restaurant is created successfully
          if (restaurant) {
            try {
              // Create salt
              const salt = await bcrypt.genSalt(10);

              try {
                // Hash password
                const hashedPassword = await bcrypt.hash(password, salt);

                try {
                  // Create vendor and populate the restaurant
                  const response = await User.create({
                    firstName,
                    lastName,
                    email,
                    role: "VENDOR",
                    status: "ARCHIVED",
                    password: hashedPassword,
                    restaurant: restaurant.id,
                  });

                  try {
                    // Populate restaurant
                    const vendorWithRestaurant = await response.populate(
                      "restaurant",
                      "-__v -updatedAt"
                    );

                    // If vendor is created successfully
                    if (vendorWithRestaurant) {
                      // Convert document to object
                      const vendor = vendorWithRestaurant.toObject();

                      // Delete fields
                      deleteFields(vendor, ["createdAt", "password"]);

                      // Return the vendor
                      res.status(200).json(vendor);
                    }
                  } catch (err) {
                    // If restaurant isn't populated
                    throw err;
                  }
                } catch (err) {
                  // If vendor isn't created successfully
                  throw err;
                }
              } catch (err) {
                // If password hashing isn't successful
                res.status(500);
                throw new Error("Failed to hash password");
              }
            } catch (err) {
              // If slat isn't create successfully
              res.status(500);
              throw new Error("Failed to create slat");
            }
          }
        } catch (err) {
          // If restaurant isn't created successfully
          throw err;
        }
      } catch (err) {
        // If vendor isn't found successfully
        throw err;
      }
    } else {
      // If role isn't admin
      res.status(403);
      throw new Error("Not authorized");
    }
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
      try {
        // Fetch 20 latest vendors with restaurant data
        const vendors = await User.find({ role: "VENDOR" })
          .limit(+limit)
          .select("-__v -password -createdAt -updatedAt")
          .sort({ createdAt: -1 })
          .populate("restaurant", "-__v -updatedAt");

        // Return the vendors
        res.status(200).json(vendors);
      } catch (err) {
        // If vendors aren't fetched successfully
        throw err;
      }
    } else {
      // If role isn't admin
      res.status(403);
      throw new Error("Not authorized");
    }
  }
});

// Update a vendor
router.patch(
  "/:vendorId/update-vendor-details",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { vendorId } = req.params;
    const {
      firstName,
      lastName,
      email,
      city,
      state,
      zip,
      restaurantName,
      addressLine1,
      addressLine2,
    }: IVendorPayload = req.body;

    // If a value isn't provided
    if (
      !vendorId ||
      !firstName ||
      !lastName ||
      !email ||
      !city ||
      !state ||
      !zip ||
      !restaurantName ||
      !addressLine1 ||
      !addressLine2
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
        try {
          // Find and update the vendor
          const updatedVendor = await User.findOneAndUpdate(
            { _id: vendorId },
            {
              firstName,
              lastName,
              email,
            },
            { returnDocument: "after" }
          )
            .lean()
            .orFail();

          try {
            // Find and update the restaurant
            const updatedRestaurant = await Restaurant.findOneAndUpdate(
              { _id: updatedVendor.restaurant._id },
              {
                name: restaurantName,
                address: `${addressLine1}, ${addressLine2}, ${city}, ${state} ${zip}`,
              },
              {
                returnDocument: "after",
              }
            )
              .lean()
              .orFail();

            // Delete fields
            deleteFields(updatedRestaurant, ["createdAt"]);
            deleteFields(updatedVendor, ["createdAt", "password"]);

            // Create updated vendor with restaurant
            const updatedVendorAndRestaurant = {
              ...updatedVendor,
              restaurant: updatedRestaurant,
            };

            // Send the data with response
            res.status(201).json(updatedVendorAndRestaurant);
          } catch (err) {
            // If restaurant isn't updated successfully
            throw err;
          }
        } catch (err) {
          // If vendor isn't updated successfully
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

// Change vendor status
router.patch(
  "/:vendorId/change-vendor-status",
  authUser,
  async (req: Request, res: Response) => {
    // Get the role from req
    const { vendorId } = req.params;
    const { action }: IVendorStatusPayload = req.body;

    // If action or restaurant id aren't provided
    if (!vendorId || !action) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check actions validity
    checkActions(undefined, action, res);

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        try {
          // Find the vendor and update the status
          const updatedVendor = await User.findOneAndUpdate(
            { _id: vendorId },
            {
              status: action === "Archive" ? "ARCHIVED" : "ACTIVE",
            },
            {
              returnDocument: "after",
            }
          )
            .select("-__v -password -updatedAt")
            .populate("restaurant", "-__v -updatedAt")
            .lean()
            .orFail();

          // Return the updated restaurant
          res.status(200).json(updatedVendor);
        } catch (err) {
          // If vendor isn't updated successfully
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

export default router;
