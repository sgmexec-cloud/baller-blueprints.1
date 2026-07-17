export async function invokeLLM(params: InvokeParams & { modelOverride?: string }): Promise<InvokeResult> {
  // Corrected the function name to match the definition (capital K)
  assertApiKey();

  const { 
    messages, 
    tools, 
    toolChoice, 
    tool_choice, 
    responseFormat, 
    response_format, 
    modelOverride 
  } = params;

  const payload: Record<string, unknown> = {
    model: modelOverride ?? "llama-3.1-8b-instant", 
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  
  payload.max_tokens = 4000;

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}
