import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        capture: fileURLToPath(new URL("./capture.html", import.meta.url)),
      },
    },
  },
});
