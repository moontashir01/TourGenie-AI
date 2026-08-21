import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set in your .env file");
  }
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri);
  } catch (err) {
    if (/querySrv|ENOTFOUND|EREFUSED|ECONNREFUSED/.test(err.message) && uri.startsWith("mongodb+srv://")) {
      throw new Error(
        `${err.message}\n` +
          "This is a DNS problem, not a credentials problem: Node cannot look up the " +
          "SRV record for the cluster. Use the standard (non-SRV) connection string " +
          "instead — Atlas > Connect > Drivers > 'mongodb://' — which lists the shard " +
          "hosts directly and skips the SRV lookup."
      );
    }
    throw err;
  }
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}
