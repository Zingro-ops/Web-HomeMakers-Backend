export function isOpenNow(hours) {
  if (!hours) return null; // unknown — cook hasn't set hours yet
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const now = new Date();
  const day = days[now.getDay()];
  const today = hours[day];
  if (!today || today.closed || !today.open || !today.close) return false;

  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= oh * 60 + om && nowMin <= ch * 60 + cm;
}
