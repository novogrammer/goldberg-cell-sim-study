import { defineConfig } from "vite";

export default defineConfig({
  base: "/goldberg-cell-sim-study/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) {
            return "three";
          }

          if (id.includes("/node_modules/")) {
            return "vendor";
          }

          return undefined;
        }
      }
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
