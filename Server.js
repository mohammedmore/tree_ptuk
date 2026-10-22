import app, { startServer } from "./server/app.js";
import { supabase } from "./server/db.js";

const PORT = process.env.PORT || 3001;

startServer(PORT);

export { app, supabase };
