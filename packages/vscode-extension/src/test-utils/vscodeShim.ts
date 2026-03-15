export const ViewColumn = {
  One: 1,
  Active: 1,
  Beside: 2
};

function createFileUri(fsPath: string) {
  const normalized = fsPath.startsWith("/") ? fsPath : `/${fsPath}`;

  return {
    scheme: "file",
    fsPath,
    path: normalized,
    toString(): string {
      return `file://${normalized}`;
    },
    toJSON() {
      return {
        scheme: "file",
        path: normalized,
        fsPath
      };
    }
  };
}

function createParsedUri(value: string) {
  return {
    scheme: value.split(":", 1)[0] || "https",
    fsPath: value,
    path: value,
    toString(): string {
      return value;
    },
    toJSON() {
      return {
        scheme: value.split(":", 1)[0] || "https",
        path: value,
        fsPath: value
      };
    }
  };
}

export const Uri = {
  file(fsPath: string) {
    return createFileUri(fsPath);
  },
  parse(value: string) {
    return createParsedUri(value);
  }
};

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
  async showInputBox(): Promise<unknown> {
    return undefined;
  },
  async showTextDocument(): Promise<unknown> {
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
  },
  createWebviewPanel(
    viewType: string,
    title: string,
    column: number,
    options: Record<string, unknown> = {}
  ) {
    return {
      viewType,
      title,
      column,
      options,
      webview: {
        html: "",
        options,
        cspSource: "vscode-webview://test"
      },
      reveal(): void {
        // no-op in tests
      },
      dispose(): void {
        // no-op in tests
      }
    };
  }
};

export const workspace = {
  workspaceFolders: undefined as unknown,
  async openTextDocument(): Promise<unknown> {
    return undefined;
  }
};

export const commands = {
  registerCommand() {
    return {
      dispose(): void {
        // no-op in tests
      }
    };
  },
  async executeCommand(): Promise<unknown> {
    return undefined;
  }
};

export const env = {
  clipboard: {
    async writeText(): Promise<void> {
      // no-op in tests
    }
  },
  async openExternal(): Promise<boolean> {
    return true;
  }
};
