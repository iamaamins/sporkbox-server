import jwt from "jsonwebtoken";

// Generate jwt token
export default function generateToken(id: string) {
  return jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });
}
