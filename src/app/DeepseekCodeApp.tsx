import React, { useRef, useState } from "react";
import { Box, Text, useApp } from "ink";
import TextInput from "ink-text-input";
import type { ConversationMessage } from "../core/types.js";
import { runConversationTurn } from "../core/runConversationTurn.js";
import { DeepSeekProvider } from "../provider/deepseek/DeepSeekProvider.js";
import { resolveConfig } from "../services/config.js";
import { saveSession } from "../services/storage.js";
import type { Session } from "../core/types.js";
import { getToolDefinitions } from "../tools/registry.js";

type DisplayRole = "system" | "user" | "assistant" | "tool";

type DisplayMessage = {
  id: string;
  role: DisplayRole;
  content: string;
};

type ConfirmationRequest = {
  message: string;
  resolve: (approved: boolean) => void;
};

function roleColor(role: DisplayRole): "cyan" | "green" | "magenta" | "yellow" {
  switch (role) {
    case "user":
      return "green";
    case "assistant":
      return "magenta";
    case "tool":
      return "yellow";
    default:
      return "cyan";
  }
}

function roleLabel(role: DisplayRole): string {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Deepseek";
    case "tool":
      return "Tool";
    default:
      return "System";
  }
}

function truncate(text: string, maxLength = 500): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...`;
}

export function DeepseekCodeApp({
  initialSession
}: {
  initialSession: Session;
}): React.ReactNode {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([
    {
      id: "welcome",
      role: "system",
      content: "Deepseek Code ready. Use /help for commands."
    }
  ]);
  const [model, setModel] = useState(initialSession.model);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const sessionRef = useRef<Session>(initialSession);
  const toolsRef = useRef(getToolDefinitions());

  function appendDisplayMessage(message: DisplayMessage): void {
    setDisplayMessages((current) => [...current, message]);
  }

  function upsertAssistantMessage(messageId: string, content: string): void {
    setDisplayMessages((current) => {
      const existingIndex = current.findIndex((message) => message.id === messageId);
      if (existingIndex >= 0) {
        return current.map((message) =>
          message.id === messageId ? { ...message, content } : message
        );
      }

      return [
        ...current,
        {
          id: messageId,
          role: "assistant",
          content
        }
      ];
    });
  }

  async function persistSession(): Promise<void> {
    sessionRef.current.updatedAt = new Date().toISOString();
    await saveSession(sessionRef.current);
  }

  async function handleSlashCommand(value: string): Promise<void> {
    const [command, ...args] = value.trim().split(/\s+/);

    switch (command) {
      case "/help":
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: "Commands: /help /model [name] /clear /status /tools /quit"
        });
        return;
      case "/model": {
        const nextModel = args[0];
        if (!nextModel) {
          appendDisplayMessage({
            id: crypto.randomUUID(),
            role: "system",
            content: `Current model: ${model}`
          });
          return;
        }

        sessionRef.current.model = nextModel;
        setModel(nextModel);
        await persistSession();
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: `Model set to ${nextModel}`
        });
        return;
      }
      case "/clear":
        sessionRef.current.messages = [];
        setDisplayMessages([]);
        await persistSession();
        return;
      case "/status": {
        const config = await resolveConfig({ model: sessionRef.current.model });
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: JSON.stringify(
            {
              workspaceRoot: sessionRef.current.workspaceRoot,
              model: sessionRef.current.model,
              apiKeyConfigured: Boolean(config.apiKey),
              baseUrl: config.baseUrl
            },
            null,
            2
          )
        });
        return;
      }
      case "/tools":
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: toolsRef.current.map((tool) => tool.name).join("\n")
        });
        return;
      case "/quit":
        exit();
        return;
      default:
        appendDisplayMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: `Unknown command: ${command}`
        });
    }
  }

  async function submitPrompt(value: string): Promise<void> {
    appendDisplayMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: value
    });

    const config = await resolveConfig({ model: sessionRef.current.model });
    if (!config.apiKey) {
      appendDisplayMessage({
        id: crypto.randomUUID(),
        role: "system",
        content: "Missing API key. Run `deepseek code login` first."
      });
      return;
    }

    const provider = new DeepSeekProvider(config);

    await runConversationTurn({
      session: sessionRef.current,
      prompt: value,
      provider,
      tools: toolsRef.current,
      confirm: (message) =>
        new Promise<boolean>((resolve) => {
          setConfirmation({ message, resolve });
        }),
      callbacks: {
        onAssistantMessageCreated: (messageId) => {
          upsertAssistantMessage(messageId, "");
        },
        onAssistantDelta: (messageId, _delta, fullText) => {
          upsertAssistantMessage(messageId, fullText);
        },
        onToolEvent: (event) => {
          if (event.type === "tool-start") {
            appendDisplayMessage({
              id: crypto.randomUUID(),
              role: "tool",
              content: `${event.toolName} ${event.confirmationRequired ? "(awaiting confirmation)" : "(running)"}`
            });
            return;
          }

          appendDisplayMessage({
            id: crypto.randomUUID(),
            role: "tool",
            content: `${event.toolName}: ${truncate(event.result.output)}`
          });
        }
      }
    });
  }

  async function handleSubmit(value: string): Promise<void> {
    const normalized = value.trim();
    setInput("");

    if (!normalized) {
      return;
    }

    if (confirmation) {
      const approved = ["y", "yes"].includes(normalized.toLowerCase());
      confirmation.resolve(approved);
      setConfirmation(null);
      appendDisplayMessage({
        id: crypto.randomUUID(),
        role: "system",
        content: approved ? "Approved" : "Denied"
      });
      return;
    }

    if (busy) {
      return;
    }

    setBusy(true);
    try {
      if (normalized.startsWith("/")) {
        await handleSlashCommand(normalized);
      } else {
        await submitPrompt(normalized);
      }
    } catch (error) {
      appendDisplayMessage({
        id: crypto.randomUUID(),
        role: "system",
        content: (error as Error).message
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan">
        deepseek code · {sessionRef.current.workspaceRoot} · model {model}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {displayMessages.map((message) => (
          <Text key={message.id} color={roleColor(message.role)}>
            {roleLabel(message.role)}: {message.content}
          </Text>
        ))}
      </Box>
      {busy && !confirmation ? (
        <Text color="yellow">Thinking...</Text>
      ) : null}
      {confirmation ? (
        <Text color="yellow">
          Confirm: {confirmation.message} (yes/no)
        </Text>
      ) : null}
      <Box marginTop={1}>
        <Text color="green">{confirmation ? "confirm> " : "prompt> "}</Text>
        <TextInput value={input} onChange={setInput} onSubmit={(value) => void handleSubmit(value)} />
      </Box>
    </Box>
  );
}
