import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
try {
    await connectDatabase(env.MONGODB_URI);
    const server = app.listen(env.PORT, "127.0.0.1", () => {
        logger.info({ port: env.PORT }, "Forma API started");
    });
    let shuttingDown = false;
    async function shutdown(signal) {
        if (shuttingDown)
            return;
        shuttingDown = true;
        logger.info({ signal }, "Shutting down");
        server.close(async () => {
            try {
                await disconnectDatabase();
                process.exit(0);
            }
            catch (error) {
                logger.error({ err: error }, "Shutdown error");
                process.exit(1);
            }
        });
    }
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
catch (error) {
    logger.error({ err: error }, "API startup failed");
    process.exitCode = 1;
}
