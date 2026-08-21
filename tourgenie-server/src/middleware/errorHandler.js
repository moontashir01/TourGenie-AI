export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  const status = res.statusCode !== 200 ? res.statusCode : err.status || 500;

  if (err.name === "ValidationError") {
    // Name the offending fields — a bare "Validation failed" says nothing about
    // which value the model or the client actually got wrong.
    const fields = Object.entries(err.errors || {}).map(([path, e]) => `${path}: ${e.message}`);
    console.error("ValidationError:", fields.join(" | "));
    return res.status(400).json({
      message: fields.length ? `Validation failed — ${fields.join("; ")}` : "Validation failed",
      errors: err.errors,
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "A record with that value already exists" });
  }

  console.error(err);
  res.status(status).json({
    message: err.message || "Something went wrong",
    // Structured context a handler attached deliberately (e.g. the budget
    // estimate behind a "budget too low" rejection) so the client can show
    // the numbers instead of only the sentence.
    details: err.details,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}
