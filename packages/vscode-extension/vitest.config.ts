import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/services/managedInstallService.ts",
        "src/services/managedRemoveService.ts",
        "src/services/profileAssetService.ts",
        "src/services/selectionResolver.ts"
      ],
      thresholds: {
        lines: 88,
        statements: 88,
        branches: 78,
        functions: 88
      }
    }
  }
});
