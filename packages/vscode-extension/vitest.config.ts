import * as path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "src/test-utils/vscodeShim.ts")
    }
  },
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/commands/installCommand.ts",
        "src/commands/removeCommand.ts",
        "src/commands/repairCommand.ts",
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
