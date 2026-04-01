// __tests__/voiceGateway.test.js

// Mock dependencies
jest.mock('node-fetch');
jest.mock('../morganToggle', () => ({
  isMorganEnabled: jest.fn(() => true),
}));
jest.mock('../rateLimitState', () => ({
  setLastVapi429At: jest.fn(),
  getLastVapi429At: jest.fn(() => 0),
}));

describe('voiceGateway', () => {
  let startOutboundCall;
  let isMorganEnabled;
  let setLastVapi429At;
  let fetch;
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = {
      VAPI_API_KEY: process.env.VAPI_API_KEY,
      VAPI_MORGAN_ASSISTANT_ID: process.env.VAPI_MORGAN_ASSISTANT_ID,
      VAPI_PHONE_NUMBER_IDS: process.env.VAPI_PHONE_NUMBER_IDS,
    };

    // Set test env vars
    process.env.VAPI_API_KEY = 'test-api-key';
    process.env.VAPI_MORGAN_ASSISTANT_ID = 'test-morgan-id';
    process.env.VAPI_PHONE_NUMBER_IDS = 'phone-1,phone-2,phone-3';

    // Clear module cache and reimport
    jest.resetModules();
    jest.clearAllMocks();

    fetch = require('node-fetch');
    const voiceGateway = require('../voiceGateway');
    startOutboundCall = voiceGateway.startOutboundCall;

    isMorganEnabled = require('../morganToggle').isMorganEnabled;
    setLastVapi429At = require('../rateLimitState').setLastVapi429At;
  });

  afterEach(() => {
    // Restore original env
    Object.keys(originalEnv).forEach((key) => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
  });

  describe('startOutboundCall', () => {
    test('should make successful call with valid parameters', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'call-123', status: 'queued' }),
        text: jest.fn(),
      };
      fetch.mockResolvedValue(mockResponse);

      const result = await startOutboundCall({
        agentName: 'Morgan',
        toNumber: '+13055551234',
        metadata: { test: 'data' },
        callName: 'Test Call',
      });

      expect(result).toEqual({
        provider: 'vapi',
        callId: 'call-123',
        raw: { id: 'call-123', status: 'queued' },
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.vapi.ai/call',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    test('should normalize phone number to E.164 format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'call-123' }),
      };
      fetch.mockResolvedValue(mockResponse);

      await startOutboundCall({
        agentName: 'Morgan',
        toNumber: '3055551234', // Without +1
        metadata: {},
        callName: 'Test',
      });

      const callArgs = fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.customer.number).toBe('+13055551234');
    });

    test('should skip call when Morgan is disabled', async () => {
      isMorganEnabled.mockReturnValue(false);

      const result = await startOutboundCall({
        agentType: 'morgan',
        agentName: 'Morgan',
        toNumber: '+13055551234',
        metadata: {},
        callName: 'Test',
      });

      expect(result).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should throw error when VAPI_API_KEY is missing', async () => {
      delete process.env.VAPI_API_KEY;
      jest.resetModules();
      const { startOutboundCall } = require('../voiceGateway');

      await expect(
        startOutboundCall({
          agentName: 'Morgan',
          toNumber: '+13055551234',
          metadata: {},
          callName: 'Test',
        })
      ).rejects.toThrow('Missing VAPI_API_KEY env var');
    });

    test('should throw error when toNumber is missing', async () => {
      await expect(
        startOutboundCall({
          agentName: 'Morgan',
          metadata: {},
          callName: 'Test',
        })
      ).rejects.toThrow('startOutboundCall requires toNumber');
    });

    test('should throw error when phone number is invalid', async () => {
      await expect(
        startOutboundCall({
          agentName: 'Morgan',
          toNumber: 'invalid',
          metadata: {},
          callName: 'Test',
        })
      ).rejects.toThrow('could not be normalized to E.164');
    });

    test('should handle 429 rate limit error', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Rate limit exceeded'),
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(
        startOutboundCall({
          agentName: 'Morgan',
          toNumber: '+13055551234',
          metadata: {},
          callName: 'Test',
        })
      ).rejects.toThrow('Vapi create call failed');

      expect(setLastVapi429At).toHaveBeenCalledWith(expect.any(Number));
    });

    test('should handle non-429 API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal server error'),
      };
      fetch.mockResolvedValue(mockResponse);

      await expect(
        startOutboundCall({
          agentName: 'Morgan',
          toNumber: '+13055551234',
          metadata: {},
          callName: 'Test',
        })
      ).rejects.toThrow('Vapi create call failed');

      expect(setLastVapi429At).not.toHaveBeenCalled();
    });

    test('should use explicit phoneNumberId when provided', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'call-123' }),
      };
      fetch.mockResolvedValue(mockResponse);

      await startOutboundCall({
        agentName: 'Morgan',
        toNumber: '+13055551234',
        metadata: {},
        callName: 'Test',
        phoneNumberId: 'explicit-phone-id',
      });

      const callArgs = fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.phoneNumberId).toBe('explicit-phone-id');
    });

    test('should round-robin through phone number IDs', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'call-123' }),
      };
      fetch.mockResolvedValue(mockResponse);

      // Make 3 calls
      await startOutboundCall({
        agentName: 'Morgan',
        toNumber: '+13055551234',
        metadata: {},
        callName: 'Test 1',
      });

      await startOutboundCall({
        agentName: 'Morgan',
        toNumber: '+13055551234',
        metadata: {},
        callName: 'Test 2',
      });

      await startOutboundCall({
        agentName: 'Morgan',
        toNumber: '+13055551234',
        metadata: {},
        callName: 'Test 3',
      });

      // Check that different phone IDs were used
      const bodies = fetch.mock.calls.map((call) => JSON.parse(call[1].body));
      expect(bodies[0].phoneNumberId).toBe('phone-1');
      expect(bodies[1].phoneNumberId).toBe('phone-2');
      expect(bodies[2].phoneNumberId).toBe('phone-3');
    });
  });
});
