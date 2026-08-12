export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  const status = res.statusCode !== 200 ? res.statusCode : err.status || 500;

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "Validation failed", errors: err.errors });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "A record with that value already exists" });
  }

  console.error(err);
  res.status(status).json({
    message: err.message || "Something went wrong",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}
