import { sendWhatsAppTemplateMessage } from "./whatsapp";
import { formatHongKongTime } from "./weather";

export async function sendManualTestWhatsAppMessage() {
  return sendWhatsAppTemplateMessage({
    status: "Weather signal UP",
    warningName: "Manual test alert",
    timestamp: formatHongKongTime(new Date()),
    detail: "This is a test message from the WhatsApp Weather Signal Notifier.",
  });
}
