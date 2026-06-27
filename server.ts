import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import net from "net";

dotenv.config();

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });
    server.on("error", () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

async function startServer() {
  const app = express();

  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send("User-agent: *\nDisallow: /");
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite dev middleware...");
    const hmrPort = await findAvailablePort(24678);
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          port: hmrPort,
        }
      },
      appType: "spa",
    });
    if (hmrPort !== 24678) {
      console.log(`Note: HMR Port 24678 was busy, using ${hmrPort} instead.`);
    }
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const defaultPort = parseInt(process.env.PORT || "8080");
  const port = await findAvailablePort(defaultPort);

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    if (port !== defaultPort) {
      console.log(`Note: Port ${defaultPort} was busy, using ${port} instead.`);
    }
  });
}

startServer();
