import { describe, expect, it } from "vitest";
import { buildWhatsAppTemplatePayload } from "./whatsapp";

describe("buildWhatsAppTemplatePayload", () => {
  it("builds a Meta WhatsApp Cloud API template message payload", () => {
    const payload = buildWhatsAppTemplatePayload(
      {
        status: "Weather signal UP",
        warningName: "Thunderstorm Warning",
        timestamp: "17 Jun 2026, 20:00 HKT",
        detail: "Thunderstorm Warning is in force.",
      },
      {
        to: "85251234567",
        templateName: "weather_signal_alert",
        templateLanguage: "en",
      },
    );

    expect(payload).toEqual({
      messaging_product: "whatsapp",
      to: "85251234567",
      type: "template",
      template: {
        name: "weather_signal_alert",
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Weather signal UP" },
              { type: "text", text: "Thunderstorm Warning" },
              { type: "text", text: "17 Jun 2026, 20:00 HKT" },
              { type: "text", text: "Thunderstorm Warning is in force." },
            ],
          },
        ],
      },
    });
  });
});
