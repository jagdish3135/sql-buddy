import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Serves POST /api/ask during `vite dev`, using the same handler as the Vercel function.
function askApi(): Plugin {
  return {
    name: "sql-buddy-ask-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      server.middlewares.use("/api/ask", async (req, res) => {
        const mod = (await server.ssrLoadModule("/server/ask.ts")) as typeof import("./server/ask");
        res.setHeader("content-type", "application/json");
        if (req.method === "GET") return res.end(JSON.stringify(mod.status(env)));
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: unknown = null;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          /* handled by ask() */
        }
        const { status, json } = await mod.ask(body, env);
        res.statusCode = status;
        res.end(JSON.stringify(json));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), askApi()],
  optimizeDeps: { exclude: ["@duckdb/duckdb-wasm"] },
  build: { chunkSizeWarningLimit: 1500 },
});
