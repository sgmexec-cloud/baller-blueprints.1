import { ENV } from "./env";

// --- Types ---
export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string; };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high"; }; };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4"; }; };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = { role: Role; content: MessageContent | MessageContent[]; name?: string; tool_call_id?: string; };
export type Tool = { type: "function"; function: { name: string; description?: string; parameters?: Record<string, unknown>; }; };
export type ToolChoice = "none" | "auto" | "required" | { name: string };
export type InvokeParams = { messages: Message[]; tools?: Tool[]; toolChoice?: ToolChoice; maxTokens?: number; };
export type InvokeResult = { choices: Array<{ message: { content: string | any; }; }>; };

// --- Helper Functions ---
const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (part: MessageContent) => (typeof part === "string" ? { type: "text", text: part } : part);

const normalizeMessage = (message: Message) => {
  const content = ensureArray(message.content).map(normalizeContentPart);
  return { ...message, content: content.length === 1 && 'text' in content[0] ? (content[0] as any).text : content };
};

const normalizeToolChoice = (tc: ToolChoice | undefined) => {
  if (!tc || tc === "auto" || tc === "none") return tc;
  if (tc === "required") return "required";
  return { type: "function", function: { name: tc.name } };
};

const resolveApiUrl = () => "https://api.groq.com/openai/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) throw new Error("API_KEY is not configured");
};

// --- Main Function ---
export async function invokeLLM(params: InvokeParams & { modelOverride?: string }): Promise<InvokeResult> {
  assertApiKey();
  const { messages, tools, toolChoice, modelOverride } = params;

  const payload = {
    model: modelOverride ?? "llama-3.1-8b-instant",
    messages: messages.map(normalizeMessage),
    tools: tools,
    tool_choice: normalizeToolChoice(toolChoice),
    max_tokens: 4000,
  };

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ENV.forgeApiKey}` },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}
