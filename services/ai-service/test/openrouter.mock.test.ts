/**
 * Mocked OpenRouter Test Suite
 *
 * Verifies OpenRouter client behavior, error classification, streaming,
 * timeouts, and secret sanitization without making real paid API requests.
 */

import { OpenRouterClient, OpenRouterError } from '../src/services/openrouter.client.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`${GREEN}✓ PASS${RESET} — ${testName}`);
    passed++;
  } else {
    console.error(`${RED}✗ FAIL${RESET} — ${testName}${details ? `: ${details}` : ''}`);
    failed++;
  }
}

async function runMockTests() {
  console.log(`\n${CYAN}=== OpenRouter Client Mock Test Suite ===${RESET}\n`);

  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  try {
    // --------------------------------------------------------------------------
    // Test 1: Missing API Key Guard
    // --------------------------------------------------------------------------
    {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_KEY;
      process.env.OPENROUTER_MODEL = 'mistralai/mistral-small-24b-instruct-2501';

      let caughtError: any = null;
      try {
        new OpenRouterClient();
      } catch (err) {
        caughtError = err;
      }

      assert(
        caughtError instanceof OpenRouterError && caughtError.statusCode === 401,
        'Instantiating without API key throws OpenRouterError (401)'
      );
    }

    // --------------------------------------------------------------------------
    // Test 2: Missing Model Configuration Guard
    // --------------------------------------------------------------------------
    {
      process.env.OPENROUTER_API_KEY = 'mock-test-key-12345';
      delete process.env.OPENROUTER_MODEL;

      let caughtError: any = null;
      try {
        new OpenRouterClient();
      } catch (err) {
        caughtError = err;
      }

      assert(
        caughtError instanceof OpenRouterError && caughtError.statusCode === 500,
        'Instantiating without OPENROUTER_MODEL throws OpenRouterError (500)'
      );
    }

    // --------------------------------------------------------------------------
    // Test 3: Standard Initialization & Headers
    // --------------------------------------------------------------------------
    {
      const TEST_SECRET = 'mock-secret-key-abcdef';
      process.env.OPENROUTER_API_KEY = TEST_SECRET;
      process.env.OPENROUTER_MODEL = 'mistralai/mistral-small-24b-instruct-2501';
      process.env.OPENROUTER_SITE_URL = 'http://localhost:8080';
      process.env.OPENROUTER_APP_NAME = 'OX-DIGITAL Education';
      process.env.OPENROUTER_TIMEOUT_MS = '25000';
      process.env.OPENROUTER_MAX_RETRIES = '0';

      const client = new OpenRouterClient();
      assert(client !== null, 'Client instantiates cleanly with valid environment');

      // Verify headers
      const headers = (client as any).headers;
      assert(headers['Authorization'] === `Bearer ${TEST_SECRET}`, 'Authorization header contains Bearer token');
      assert(headers['HTTP-Referer'] === 'http://localhost:8080', 'HTTP-Referer set to OX-DIGITAL site URL');
      assert(headers['X-Title'] === 'OX-DIGITAL Education', 'X-Title set to OX-DIGITAL app name');
    }

    // --------------------------------------------------------------------------
    // Test 4: Mocked Successful Non-Streaming Chat Completion
    // --------------------------------------------------------------------------
    {
      let fetchCallCount = 0;
      let capturedBody: any = null;

      global.fetch = async (url: any, init: any) => {
        fetchCallCount++;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'mock-chat-123',
            choices: [
              {
                message: { role: 'assistant', content: '{"answer":"x = 5","steps":[]}' },
                finish_reason: 'stop'
              }
            ],
            usage: { prompt_tokens: 25, completion_tokens: 15, total_tokens: 40 }
          })
        } as any;
      };

      const client = new OpenRouterClient();
      const res = await client.chatCompletion({
        messages: [{ role: 'user', content: 'Solve 2x = 10' }],
        temperature: 0.1,
        max_tokens: 500
      });

      assert(fetchCallCount === 1, 'Exactly one HTTP request was dispatched (no duplicate billable calls)');
      assert(capturedBody?.model === 'mistralai/mistral-small-24b-instruct-2501', 'Request body contains configured primary model');
      assert(res.choices[0].message.content.includes('x = 5'), 'Response choices properly parsed from mock response');
      assert(res.usage?.total_tokens === 40, 'Usage metrics correctly extracted');
    }

    // --------------------------------------------------------------------------
    // Test 5: Mocked Streaming Chat Completion
    // --------------------------------------------------------------------------
    {
      global.fetch = async () => {
        const streamData = [
          'data: {"choices":[{"delta":{"content":"مرحبا"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" بكم"}}]}\n\n',
          'data: [DONE]\n\n'
        ].join('');

        const encoder = new TextEncoder();
        const uint8 = encoder.encode(streamData);
        let read = false;

        return {
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: async () => {
                if (!read) {
                  read = true;
                  return { done: false, value: uint8 };
                }
                return { done: true, value: undefined };
              }
            })
          }
        } as any;
      };

      const client = new OpenRouterClient();
      const chunks: string[] = [];
      for await (const chunk of client.chatCompletionStream({
        messages: [{ role: 'user', content: 'مرحبا' }]
      })) {
        chunks.push(chunk);
      }

      assert(chunks.join('').includes('مرحبا بكم'), 'Stream chunks successfully decoded and accumulated');
    }

    // --------------------------------------------------------------------------
    // Test 6: Upstream 401 Unauthorized Handling
    // --------------------------------------------------------------------------
    {
      global.fetch = async () => ({
        ok: false,
        status: 401,
        text: async () => '{"error":{"message":"User key invalid"}}'
      } as any);

      const client = new OpenRouterClient();
      let caught: any = null;
      try {
        await client.chatCompletion({ messages: [{ role: 'user', content: 'test' }] });
      } catch (err) {
        caught = err;
      }

      assert(caught instanceof OpenRouterError, 'HTTP 401 throws OpenRouterError');
      assert(caught.statusCode === 401, 'Error status code matches 401');
      assert(!caught.isRetryable, 'Authentication errors are marked non-retryable');
      assert(!caught.message.includes(process.env.OPENROUTER_API_KEY!), 'Error message does not leak secret API key');
    }

    // --------------------------------------------------------------------------
    // Test 7: Upstream 402 Insufficient Credits Handling
    // --------------------------------------------------------------------------
    {
      global.fetch = async () => ({
        ok: false,
        status: 402,
        text: async () => '{"error":{"message":"Insufficient credits"}}'
      } as any);

      const client = new OpenRouterClient();
      let caught: any = null;
      try {
        await client.chatCompletion({ messages: [{ role: 'user', content: 'test' }] });
      } catch (err) {
        caught = err;
      }

      assert(caught instanceof OpenRouterError && caught.statusCode === 402, 'HTTP 402 classifies as Payment required');
      assert(!caught.isRetryable, 'Payment required is non-retryable');
    }

    // --------------------------------------------------------------------------
    // Test 8: Upstream 429 Rate Limit Handling
    // --------------------------------------------------------------------------
    {
      global.fetch = async () => ({
        ok: false,
        status: 429,
        text: async () => '{"error":{"message":"Rate limit exceeded"}}'
      } as any);

      const client = new OpenRouterClient();
      let caught: any = null;
      try {
        await client.chatCompletion({ messages: [{ role: 'user', content: 'test' }] });
      } catch (err) {
        caught = err;
      }

      assert(caught instanceof OpenRouterError && caught.statusCode === 429, 'HTTP 429 classifies as Rate limit exceeded');
      assert(caught.isRetryable === true, 'Rate limit error is marked retryable');
    }

    // --------------------------------------------------------------------------
    // Test 9: Timeout (AbortError) Handling
    // --------------------------------------------------------------------------
    {
      global.fetch = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const client = new OpenRouterClient({ timeoutMs: 100 });
      let caught: any = null;
      try {
        await client.chatCompletion({ messages: [{ role: 'user', content: 'test' }] });
      } catch (err) {
        caught = err;
      }

      assert(caught instanceof OpenRouterError && caught.statusCode === 408, 'AbortError translates to HTTP 408 Request Timeout');
    }

    // --------------------------------------------------------------------------
    // Test 10: Zero Duplicate Retry Guarantee When maxRetries=0
    // --------------------------------------------------------------------------
    {
      let callCount = 0;
      global.fetch = async () => {
        callCount++;
        return {
          ok: false,
          status: 500,
          text: async () => '{"error":{"message":"Internal server error"}}'
        } as any;
      };

      const client = new OpenRouterClient({ maxRetries: 0 });
      try {
        await client.chatCompletion({ messages: [{ role: 'user', content: 'test' }] });
      } catch {}

      assert(callCount === 1, 'When maxRetries=0, exactly 1 call is made (zero billable retry loop)');
    }

  } finally {
    process.env = originalEnv;
    global.fetch = originalFetch;
  }

  console.log(`\n==============================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runMockTests();
