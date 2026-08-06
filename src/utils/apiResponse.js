export const ok = (res, data = null, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

export const fail = (res, message = "Error", status = 400, code) =>
  res.status(status).json({ success: false, message, ...(code && { code }) });
