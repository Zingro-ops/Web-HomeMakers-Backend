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
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
}
