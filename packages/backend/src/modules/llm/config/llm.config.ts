export default () => ({
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '3', 10),
    circuitBreakerThreshold: parseInt(process.env.LLM_CB_THRESHOLD || '5', 10),
    circuitBreakerResetMs: parseInt(process.env.LLM_CB_RESET_MS || '60000', 10),
  },
});
