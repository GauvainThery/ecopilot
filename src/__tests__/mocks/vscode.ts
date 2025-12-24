/**
 * Mock implementation of VS Code API for testing
 */

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn((_key: string, defaultValue?: any) => defaultValue),
  })),
};

export const window = {
  showWarningMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  })),
};

export const Uri = {
  joinPath: jest.fn((...args: any[]) => ({
    fsPath: args.slice(1).join('/'),
  })),
  file: jest.fn((path: string) => ({
    fsPath: path,
  })),
};

export class EventEmitter<T> {
  private listeners: Array<(e: T) => any> = [];

  get event() {
    return (listener: (e: T) => any) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(listener);
          if (index > -1) {
            this.listeners.splice(index, 1);
          }
        },
      };
    };
  }

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

// Mock ExtensionContext
export const createMockContext = () => ({
  subscriptions: [],
  extensionPath: '/mock/extension/path',
  extensionUri: { fsPath: '/mock/extension/path' },
  globalState: {
    get: jest.fn(),
    update: jest.fn(),
    keys: jest.fn(() => []),
  },
  workspaceState: {
    get: jest.fn(),
    update: jest.fn(),
    keys: jest.fn(() => []),
  },
  secrets: {
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
  },
  storagePath: '/mock/storage/path',
  globalStoragePath: '/mock/global/storage/path',
  logPath: '/mock/log/path',
  extensionMode: 3,
});
