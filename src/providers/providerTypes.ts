import { TestCase } from '../generators/testCaseGenerator';

export interface AiPromptRequest {
  functionName: string;
  sourceCode: string;
  parameters: string[];
  existingCasesCount: number;
}

export interface AiFailureExplanationRequest {
  testName: string;
  errorMessage: string;
  stackTrace: string;
  sourceSnippet?: string;
}

export interface AiSuggestionResult {
  success: boolean;
  testCases: TestCase[];
  explanation?: string;
  errorMessage?: string;
}

export interface AiFailureExplanationResult {
  success: boolean;
  explanation: string;
  suggestedFix?: string;
  errorMessage?: string;
}

export interface IAiProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  generateAdditionalCases(request: AiPromptRequest): Promise<AiSuggestionResult>;
  explainFailure(request: AiFailureExplanationRequest): Promise<AiFailureExplanationResult>;
}
