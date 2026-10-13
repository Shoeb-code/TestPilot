import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import {
  IAiProvider,
  AiPromptRequest,
  AiFailureExplanationRequest,
  AiSuggestionResult,
  AiFailureExplanationResult,
} from './providerTypes';
import { TestCase } from '../generators/testCaseGenerator';
import { ValidationUtils } from '../utils/validation';
import { Logger } from '../utils/logger';

export class ModularAiProvider implements IAiProvider {
  public readonly id = 'modular-ai';
  public readonly name = 'Modular AI Provider';

  public isConfigured(): boolean {
    const config = vscode.workspace.getConfiguration('testpilot.ai');
    const enabled = config.get<boolean>('enabled', false);
    const apiKey = config.get<string>('apiKey', '');
    return enabled && apiKey.trim().length > 0;
  }

  public async generateAdditionalCases(request: AiPromptRequest): Promise<AiSuggestionResult> {
    const logger = Logger.getInstance();

    if (!this.isConfigured()) {
      logger.info('AI provider not enabled or configured; skipping AI augmentation.');
      return {
        success: false,
        testCases: [],
        errorMessage:
          'AI integration is disabled or no API key is configured. TestPilot continues to function 100% locally and offline.',
      };
    }

    const config = vscode.workspace.getConfiguration('testpilot.ai');
    const apiKey = config.get<string>('apiKey', '');
    const model = config.get<string>('model', 'gpt-4o-mini');
    const endpoint = config.get<string>('endpoint', 'https://api.openai.com/v1/chat/completions');

    // Confirm consent before transmitting source code
    const consent = await vscode.window.showInformationMessage(
      `Send function "${request.functionName}" (${request.sourceCode.length} chars) to configured AI provider for test augmentation?`,
      'Proceed',
      'Cancel'
    );

    if (consent !== 'Proceed') {
      return {
        success: false,
        testCases: [],
        errorMessage: 'User declined transmitting source code to external AI provider.',
      };
    }

    const prompt = `You are a test engineer assistant. Analyze this JavaScript/TypeScript function and propose 2 additional distinct edge-case unit tests.
Function: ${request.functionName}
Parameters: ${request.parameters.join(', ')}
Source:
\`\`\`
${request.sourceCode}
\`\`\`

Return ONLY a valid JSON array of objects with the following schema:
[
  {
    "testName": "descriptive name",
    "category": "Edge",
    "inputArgs": ["literal1", "literal2"],
    "expectedThrows": false,
    "expectedResult": "optional literal",
    "reason": "why this case is valuable"
  }
]`;

    try {
      const responseText = await this.makeHttpRequest(endpoint, apiKey, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      });

      const parsedJson = this.extractJsonArray(responseText);
      if (!parsedJson) {
        return {
          success: false,
          testCases: [],
          errorMessage: 'Malformed response received from AI provider; failed JSON schema validation.',
        };
      }

      const validatedCases: TestCase[] = [];
      let index = 1;

      for (const item of parsedJson) {
        const val = ValidationUtils.validateAiScenarioPayload(item);
        if (val.valid && val.data) {
          validatedCases.push({
            id: `ai-${Date.now()}-${index++}`,
            testName: `[AI] ${val.data.testName}`,
            category: 'Edge',
            inputArgs: val.data.inputArgs.map((arg) => String(arg)),
            expectedThrows: val.data.expectedThrows ?? false,
            expectedExceptionMessage: val.data.expectedExceptionMessage,
            reason: `AI Suggested: ${val.data.reason}`,
            confidence: 'suggested',
            confidenceNote: 'AI-generated suggestion. Must be independently verified by developer.',
            selected: false,
          });
        }
      }

      logger.info(`AI provider yielded ${validatedCases.length} validated test cases.`);
      return {
        success: true,
        testCases: validatedCases,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`AI provider request failed: ${errorMsg}`);
      return {
        success: false,
        testCases: [],
        errorMessage: `AI provider error: ${errorMsg}`,
      };
    }
  }

  public async explainFailure(request: AiFailureExplanationRequest): Promise<AiFailureExplanationResult> {
    const logger = Logger.getInstance();

    if (!this.isConfigured()) {
      return {
        success: false,
        explanation:
          'AI is disabled. Please configure an API key in TestPilot settings if you wish to use AI-assisted explanations.',
      };
    }

    const config = vscode.workspace.getConfiguration('testpilot.ai');
    const apiKey = config.get<string>('apiKey', '');
    const model = config.get<string>('model', 'gpt-4o-mini');
    const endpoint = config.get<string>('endpoint', 'https://api.openai.com/v1/chat/completions');

    const prompt = `Analyze this unit test failure and concisely explain what likely went wrong and how to fix it:
Test: ${request.testName}
Error: ${request.errorMessage}
Stack:
${request.stackTrace}
${request.sourceSnippet ? `Source:\n${request.sourceSnippet}` : ''}`;

    try {
      const responseText = await this.makeHttpRequest(endpoint, apiKey, {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      return {
        success: true,
        explanation: responseText,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`AI failure explanation error: ${errorMsg}`);
      return {
        success: false,
        explanation: `Unable to obtain AI explanation: ${errorMsg}`,
        errorMessage: errorMsg,
      };
    }
  }

  private extractJsonArray(text: string): unknown[] | undefined {
    try {
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start !== -1 && end > start) {
        const jsonStr = text.substring(start, end + 1);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return undefined;
  }

  private makeHttpRequest(urlStr: string, apiKey: string, body: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const payload = JSON.stringify(body);

      const req = client.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 20000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.message?.content ?? data;
                resolve(content);
              } catch {
                resolve(data);
              }
            } else if (res.statusCode === 429) {
              reject(new Error('Rate limit exceeded (HTTP 429). Please try again later.'));
            } else if (res.statusCode === 401) {
              reject(
                new Error('Authentication failed (HTTP 401). Please verify your AI API key in TestPilot settings.')
              );
            } else {
              reject(new Error(`Server returned HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI request timed out after 20 seconds.'));
      });

      req.on('error', (e) => reject(e));
      req.write(payload);
      req.end();
    });
  }
}
