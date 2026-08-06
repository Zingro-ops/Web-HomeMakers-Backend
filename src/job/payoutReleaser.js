import cron from "node-cron";
import { releaseDuePayouts } from "../services/payout.service.js";

export function startPayoutCron() {
  // runs once daily at 6 AM IST
  cron.schedule("0 6 * * *", async () => {
    const count = await releaseDuePayouts();
    console.log(`Payout cron: released ${count} due transfers`);
  });
}
