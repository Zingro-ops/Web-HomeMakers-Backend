function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inVacation(date, vacationRanges) {
  return (vacationRanges || []).some(
    (r) => date >= new Date(r.from) && date <= new Date(r.to),
  );
}

function isSkipped(date, skippedDates) {
  return (skippedDates || []).some((d) => isSameDay(new Date(d), date));
}

export function isDueOn(subscription, date = new Date()) {
  if (subscription.status !== "active") return false;
  if (
    date < new Date(subscription.startDate) ||
    date > new Date(subscription.endDate)
  )
    return false;
  if (inVacation(date, subscription.vacationRanges)) return false;
  if (isSkipped(date, subscription.skippedDates)) return false;

  const { frequency, daysOfWeek, dayOfMonth } = subscription;
  if (frequency === "daily") return true;
  if (frequency === "weekly" || frequency === "custom")
    return (daysOfWeek || []).includes(date.getDay());
  if (frequency === "monthly") return date.getDate() === dayOfMonth;
  return false;
}
