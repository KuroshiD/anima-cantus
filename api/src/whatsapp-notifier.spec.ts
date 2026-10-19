import { WhatsAppNotifier } from "./notifications.service";

describe("WhatsAppNotifier", () => {
  it("não envia mensagem automática nesta versão", async () => {
    const notifier = new WhatsAppNotifier();
    await expect(notifier.send()).rejects.toThrow(/wa\.me/);
  });
});
