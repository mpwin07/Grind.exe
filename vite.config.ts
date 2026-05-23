import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command }) => ({
  plugins: [
    tsConfigPaths(),
    command === "build" ? cloudflare() : undefined,
    tanstackStart({
      server: { entry: "server" },
      serverFns: { disableCsrfMiddlewareWarning: true },
    }),
    viteReact(),
    tailwindcss(),
  ],
}));
