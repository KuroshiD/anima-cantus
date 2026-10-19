import { Socket } from "net";

export async function scanBuffer(host: string, port: number, data: Buffer): Promise<"OK" | "FOUND"> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let response = "";
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(20_000, () => fail(new Error("A varredura antivírus excedeu o tempo.")));
    socket.once("error", fail);
    socket.connect(port, host, () => {
      socket.write(Buffer.from("zINSTREAM\0"));
      const chunk = 64 * 1024;
      for (let offset = 0; offset < data.length; offset += chunk) {
        const slice = data.subarray(offset, Math.min(offset + chunk, data.length));
        const header = Buffer.alloc(4);
        header.writeUInt32BE(slice.length, 0);
        socket.write(header);
        socket.write(slice);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", (buf) => {
      response += buf.toString("utf8");
    });
    socket.on("end", () => {
      if (response.includes("FOUND")) resolve("FOUND");
      else if (response.includes("OK")) resolve("OK");
      else reject(new Error(response || "Resposta inválida do antivírus."));
    });
  });
}
