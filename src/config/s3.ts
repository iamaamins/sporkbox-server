import dotenv from "dotenv";
import { Response } from "express";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { generateRandomString } from "../utils";

//Configure dot env
dotenv.config();

// Configure s3 client
const s3Client = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
});

// Upload image function
export async function uploadImage(
  res: Response,
  buffer: Buffer,
  mimetype: string
) {
  // Generate random name
  const name = generateRandomString();

  // Create params
  const params = {
    Key: name,
    Body: buffer,
    ContentType: mimetype,
    Bucket: process.env.AWS_BUCKET_NAME,
  };

  try {
    // Upload image to S3
    await s3Client.send(new PutObjectCommand(params));

    // Return the image URL
    return `${process.env.CLOUDFRONT_DOMAIN}/${name}`;
  } catch (err) {
    // If image upload fails
    res.status(500);
    throw new Error("Failed to upload image");
  }
}

// Delete image from S3
export async function deleteImage(res: Response, name: string) {
  // Params
  const params = {
    Key: name,
    Bucket: process.env.AWS_BUCKET_NAME,
  };

  try {
    // Delete the image from S3
    await s3Client.send(new DeleteObjectCommand(params));
  } catch (err) {
    // If image delete fails
    res.status(500);
    throw new Error("Failed to delete image");
  }
}
