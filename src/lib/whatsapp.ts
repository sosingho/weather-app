import { getWhatsAppConfig, type WhatsAppConfig } from "./config";
import { maskRecipient } from "./state";
import {
  formatHongKongTime,
  getEventStatusText,
  summarizeWarningDetail,
  type WeatherSignalEvent,
} from "./weather";

export type WhatsAppTemplatePayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components: Array<{
      type: "body";
      parameters: Array<{
        type: "text";
        text: string;
      }>;
    }>;
  };
};

export type WhatsAppSendResult = {
  ok: boolean;
  dryRun: boolean;
  recipient: string;
  messageId?: string;
  response?: unknown;
  payload: WhatsAppTemplatePayload;
};

export type WeatherSignalMessageInput = {
  status: string;
  warningName: string;
  timestamp: string;
  detail: string;
};

export function eventToWhatsAppTemplateInput(event: WeatherSignalEvent): WeatherSignalMessageInput {
  return {
    status: getEventStatusText(event.type),
    warningName: event.warningName,
    timestamp: formatHongKongTime(event.occurredAt),
    detail: summarizeWarningDetail(event.detail, 900),
  };
}

export function buildWhatsAppTemplatePayload(
  input: WeatherSignalMessageInput,
  config: Pick<WhatsAppConfig, "to" | "templateName" | "templateLanguage">,
): WhatsAppTemplatePayload {
  return {
    messaging_product: "whatsapp",
    to: config.to,
    type: "template",
    template: {
      name: config.templateName,
      language: {
        code: config.templateLanguage,
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.status },
            { type: "text", text: input.warningName },
            { type: "text", text: input.timestamp },
            { type: "text", text: input.detail },
          ],
        },
      ],
    },
  };
}

export async function sendWeatherSignalMessage(
  event: WeatherSignalEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplateMessage(eventToWhatsAppTemplateInput(event), fetchImpl);
}

export async function sendWhatsAppTemplateMessage(
  input: WeatherSignalMessageInput,
  fetchImpl: typeof fetch = fetch,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();
  const payload = buildWhatsAppTemplatePayload(input, config);

  if (config.dryRun) {
    return {
      ok: true,
      dryRun: true,
      recipient: maskRecipient(config.to),
      payload,
      response: { dryRun: true },
    };
  }

  const response = await fetchImpl(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API request failed with ${response.status}: ${JSON.stringify(responseBody)}`);
  }

  return {
    ok: true,
    dryRun: false,
    recipient: maskRecipient(config.to),
    messageId: extractMessageId(responseBody),
    response: responseBody,
    payload,
  };
}

function extractMessageId(responseBody: unknown): string | undefined {
  if (!responseBody || typeof responseBody !== "object" || !("messages" in responseBody)) {
    return undefined;
  }

  const messages = (responseBody as { messages?: Array<{ id?: string }> }).messages;
  return messages?.[0]?.id;
}
