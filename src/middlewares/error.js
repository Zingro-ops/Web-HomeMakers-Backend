export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, req, res, next) {
  if (err?.name === "ZodError") {
    return res
      .status(422)
      .json({ error: "Validation failed", details: err.issues });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: "Email or phone already registered" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  console.error(err);
  const statusCode = err.status || err.statusCode || 500;
  const message =
    statusCode < 500 && err.message ? err.message : "Something went wrong";
  res.status(statusCode).json({ error: message });
}
