import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import net from "net";

dotenv.config();

async function findAvailablePort(startPort: number): Promise<number> {
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  for (let port = startPort; port <= 65535; port += 1) {
    const server = net.createServer();
    const isAvailable = await new Promise<boolean>((resolve, reject) => {
      server.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          resolve(false);
        } else {
          reject(error);
        }
      });
      server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
        server.close((error) => {
          if (error) reject(error);
          else resolve(true);
        });
      });
    });

    if (isAvailable) return port;
  }

  throw new Error(`No available port found between ${startPort} and 65535.`);
}

async function startServer() {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

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
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/") || !req.accepts("html")) {
        next();
        return;
      }
      res.sendFile(path.resolve(distPath, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  const configuredPort = process.env.PORT?.trim();
  const defaultPort = configuredPort ? Number(configuredPort) : 8080;
  if (!Number.isInteger(defaultPort) || defaultPort < 1 || defaultPort > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  const port = await findAvailablePort(defaultPort);

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    if (port !== defaultPort) {
      console.log(`Note: Port ${defaultPort} was busy, using ${port} instead.`);
    }
  });
}

void startServer().catch((error: unknown) => {
  console.error("Unable to start server", error);
  process.exitCode = 1;
});
