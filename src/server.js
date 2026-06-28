import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

(async () => {
  await connectDB();
  createApp().listen(env.port, () => console.log(`API on :${env.port}`));
})();
