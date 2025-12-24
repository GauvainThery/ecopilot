/**
 * Unit tests for ImpactProviderFactory
 * Tests singleton pattern, provider initialization, and error handling
 */

import * as vscode from 'vscode';
import { ImpactProviderFactory } from '../../infrastructure/ImpactProviderFactory';
import { EcoLogitsProvider } from '../../providers/ecologits/EcoLogitsProvider';
import { createMockContext } from '../mocks/vscode';

// Mock EcoLogitsProvider
jest.mock('../../providers/ecologits/EcoLogitsProvider');

describe('ImpactProviderFactory', () => {
  let mockContext: any;
  let mockConfig: any;

  beforeEach(() => {
    mockContext = createMockContext();

    // Mock workspace configuration
    mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'impactProvider') return 'ecologits';
        return defaultValue;
      }),
    };

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

    // Reset singleton between tests
    (ImpactProviderFactory as any).instance = null;

    // Clear mock constructor calls
    (EcoLogitsProvider as jest.MockedClass<typeof EcoLogitsProvider>).mockClear();
  });

  describe('singleton pattern', () => {
    it('should create instance on initialize', () => {
      ImpactProviderFactory.initialize(mockContext);

      const instance = ImpactProviderFactory.getInstance();
      expect(instance).toBeInstanceOf(ImpactProviderFactory);
    });

    it('should return same instance on multiple calls', () => {
      ImpactProviderFactory.initialize(mockContext);

      const instance1 = ImpactProviderFactory.getInstance();
      const instance2 = ImpactProviderFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should throw error if getInstance called before initialize', () => {
      expect(() => ImpactProviderFactory.getInstance()).toThrow(
        'ImpactProviderFactory not initialized'
      );
    });

    it('should not create new instance if already initialized', () => {
      ImpactProviderFactory.initialize(mockContext);
      const instance1 = ImpactProviderFactory.getInstance();

      ImpactProviderFactory.initialize(mockContext);
      const instance2 = ImpactProviderFactory.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getProvider', () => {
    beforeEach(() => {
      ImpactProviderFactory.initialize(mockContext);

      // Mock isAvailable to return true by default
      const mockIsAvailable = jest.fn().mockResolvedValue(true);
      (EcoLogitsProvider as jest.MockedClass<typeof EcoLogitsProvider>).mockImplementation(
        () =>
          ({
            name: 'EcoLogits',
            version: '1.0.0',
            isAvailable: mockIsAvailable,
            calculateImpact: jest.fn(),
          }) as any
      );
    });

    it('should create EcoLogits provider when configured', async () => {
      const factory = ImpactProviderFactory.getInstance();
      const provider = await factory.getProvider();

      expect(provider.name).toBe('EcoLogits');
      expect(EcoLogitsProvider).toHaveBeenCalledWith(mockContext);
    });

    it('should cache provider instance', async () => {
      const factory = ImpactProviderFactory.getInstance();

      const provider1 = await factory.getProvider();
      const provider2 = await factory.getProvider();

      expect(provider1).toBe(provider2);
      expect(EcoLogitsProvider).toHaveBeenCalledTimes(1);
    });

    it('should check provider availability', async () => {
      const factory = ImpactProviderFactory.getInstance();
      const mockIsAvailable = jest.fn().mockResolvedValue(true);

      (EcoLogitsProvider as jest.MockedClass<typeof EcoLogitsProvider>).mockImplementation(
        () =>
          ({
            name: 'EcoLogits',
            version: '1.0.0',
            isAvailable: mockIsAvailable,
            calculateImpact: jest.fn(),
          }) as any
      );

      await factory.getProvider();

      expect(mockIsAvailable).toHaveBeenCalled();
    });

    it('should throw error if provider is not available', async () => {
      const factory = ImpactProviderFactory.getInstance();
      const mockIsAvailable = jest.fn().mockResolvedValue(false);

      (EcoLogitsProvider as jest.MockedClass<typeof EcoLogitsProvider>).mockImplementation(
        () =>
          ({
            name: 'EcoLogits',
            version: '1.0.0',
            isAvailable: mockIsAvailable,
            calculateImpact: jest.fn(),
          }) as any
      );

      await expect(factory.getProvider()).rejects.toThrow(
        "Environmental impact provider 'EcoLogits' is not properly configured"
      );
    });

    it('should fallback to EcoLogits for unknown provider', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'impactProvider') return 'unknown-provider';
        return defaultValue;
      });

      const factory = ImpactProviderFactory.getInstance();
      const provider = await factory.getProvider();

      expect(provider.name).toBe('EcoLogits');
    });

    it('should use configured provider name', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'impactProvider') return 'EcoLogits';
        return defaultValue;
      });

      const factory = ImpactProviderFactory.getInstance();
      await factory.getProvider();

      expect(mockConfig.get).toHaveBeenCalledWith('impactProvider', 'ecologits');
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      ImpactProviderFactory.initialize(mockContext);

      const mockIsAvailable = jest.fn().mockResolvedValue(true);
      (EcoLogitsProvider as jest.MockedClass<typeof EcoLogitsProvider>).mockImplementation(
        () =>
          ({
            name: 'EcoLogits',
            version: '1.0.0',
            isAvailable: mockIsAvailable,
            calculateImpact: jest.fn(),
          }) as any
      );
    });

    it('should clear cached provider', async () => {
      const factory = ImpactProviderFactory.getInstance();

      await factory.getProvider();
      expect(EcoLogitsProvider).toHaveBeenCalledTimes(1);

      factory.reset();
      await factory.getProvider();

      // Should create new instance after reset
      expect(EcoLogitsProvider).toHaveBeenCalledTimes(2);
    });

    it('should allow provider reconfiguration after reset', async () => {
      const factory = ImpactProviderFactory.getInstance();

      // Get provider with first config
      mockConfig.get.mockReturnValue('ecologits');
      await factory.getProvider();

      // Change config and reset
      mockConfig.get.mockReturnValue('ecologits');
      factory.reset();
      await factory.getProvider();

      // Should have created new provider instance
      expect(EcoLogitsProvider).toHaveBeenCalledTimes(2);
    });
  });

  describe('provider configuration', () => {
    beforeEach(() => {
      ImpactProviderFactory.initialize(mockContext);

      const mockIsAvailable = jest.fn().mockResolvedValue(true);
      (EcoLogitsProvider as jest.MockedClass<typeof EcoLogitsProvider>).mockImplementation(
        () =>
          ({
            name: 'EcoLogits',
            version: '1.0.0',
            isAvailable: mockIsAvailable,
            calculateImpact: jest.fn(),
          }) as any
      );
    });

    it('should handle case-insensitive provider names', async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'impactProvider') {
          return 'ECOLOGITS';
        }
        return 'ecologits';
      });

      const factory = ImpactProviderFactory.getInstance();
      const provider = await factory.getProvider();

      expect(provider.name).toBe('EcoLogits');
    });

    it('should read from ecopilot configuration namespace', async () => {
      const factory = ImpactProviderFactory.getInstance();
      await factory.getProvider();

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('ecopilot');
    });
  });
});
