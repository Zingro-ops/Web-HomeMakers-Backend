export const maskTail = (val, visible = 4, char = "*") => {
  if (!val) return "";
  const tail = val.slice(-visible);
  return char.repeat(Math.max(0, val.length - visible)) + tail;
};

export const maskPan = (pan) => (pan ? "*".repeat(5) + pan.slice(5) : "");
export const maskFssai = (lic) => (lic ? "*".repeat(10) + lic.slice(-4) : "");
