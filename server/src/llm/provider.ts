export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface JsonCompletionRequest {
  messages: ChatMessage[];
  /** JSON schema the model output must follow (OpenAI structured outputs). */
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  readonly name: string;
  readonly chatModel: string;
  readonly embeddingModel: string;
  readonly dimensions: number;
  /** False when no API key is configured: callers must use keyword-only / extractive paths. */
  readonly available: boolean;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
  completeJson(req: JsonCompletionRequest): Promise<unknown>;
}
