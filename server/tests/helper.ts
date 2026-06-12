import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../routes";

export async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const server = createServer(app);
  await registerRoutes(server, app);

  return new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolve, reject) => {
    server.on("error", (err) => reject(err));
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "string" ? 0 : addr?.port;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((resolveClose) => {
            if (typeof (server as any).closeAllConnections === "function") {
              (server as any).closeAllConnections();
            }
            server.close(() => resolveClose());
          }),
      });
    });
  });
}
