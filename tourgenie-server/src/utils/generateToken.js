import jwt from "jsonwebtoken";

/**
 * `tv` is the account's token_version at the moment of signing. `protect`
 * rejects a token whose version has moved on, which is how a password change
 * ends every other session — see models/User.js.
 */
export function generateToken(user) {
  const id = user?._id ?? user;
  return jwt.sign({ id, tv: user?.token_version ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}
