export const window = {
  async showQuickPick(): Promise<unknown> {
    return undefined;
  },
  async showInformationMessage(): Promise<unknown> {
    return undefined;
  },
  async showWarningMessage(): Promise<unknown> {
    return undefined;
  },
  async showErrorMessage(): Promise<unknown> {
    return undefined;
  },
  createOutputChannel() {
    return {
      appendLine(): void {
        // no-op in tests
      },
      dispose(): void {
        // no-op in tests
      },
      show(): void {
        // no-op in tests
      }
    };
  }
};

export const commands = {
  registerCommand() {
    return {
      dispose(): void {
        // no-op in tests
      }
    };
  }
};
