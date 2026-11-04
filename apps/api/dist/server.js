import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
// Render supplies PORT=10000 by default.
// Local development uses PORT or defaults to 4000.
const port = Number(process.env.PORT ?? 4000);
// Render needs the server to listen on every
// IPv4 network interface, not just localhost.
const host = "0.0.0.0";
async function startServer() {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("Invalid server port.");
    }
    await connectDatabase(env.MONGODB_URI);
    const server = app.listen(port, host, () => {
        logger.info({
            host,
            port,
        }, "Forma API started");
    });
    server.on("error", (error) => {
        logger.error({ err: error }, "HTTP server error");
        process.exitCode = 1;
    });
    let shuttingDown = false;
    function shutdown(signal) {
        if (shuttingDown)
            return;
        shuttingDown = true;
        logger.info({ signal }, "Shutting down Forma API");
        server.close((error) => {
            void (async () => {
                try {
                    if (error) {
                        logger.error({ err: error }, "HTTP shutdown error");
                        process.exitCode = 1;
                    }
                    await disconnectDatabase();
                }
                catch (databaseError) {
                    logger.error({ err: databaseError }, "Database shutdown error");
                    process.exitCode = 1;
                }
            })();
        });
    }
    process.once("SIGTERM", () => {
        shutdown("SIGTERM");
    });
    process.once("SIGINT", () => {
        shutdown("SIGINT");
    });
}
startServer().catch((error) => {
    logger.error({ err: error }, "Unable to start Forma API");
    process.exitCode = 1;
});
