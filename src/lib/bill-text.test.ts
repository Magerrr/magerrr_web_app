import { describe, expect, it } from "vitest";
import { billText, whatsappUrl } from "./bill-text";

describe("billText", () => {
  it("teks terstruktur: kepala, transfer per penerima, rekening, tautan", () => {
    const text = billText({
      groupName: "Mabar Jumat",
      startsAt: new Date("2026-10-09T12:00:00Z"),
      venue: "GOR Uji",
      total: 280000,
      participants: 8,
      transfers: [
        { from: "Dimas", to: "Raka", amount: 35000, paid: false },
        { from: "Sinta", to: "Raka", amount: 35000, paid: true },
      ],
      payTo: [
        {
          name: "Raka",
          infos: [
            { kind: "bank", label: "BCA", accountNo: "1234567890", accountName: "Raka Putra" },
            { kind: "ewallet", label: "GoPay", accountNo: "08123", accountName: null },
            { kind: "qris", label: "QRIS", accountNo: null, accountName: null },
          ],
        },
      ],
      url: "https://magerrr.test/s/abc/tagihan",
    });
    expect(text).toBe(
      [
        "Tagihan mabar Mabar Jumat",
        "Jumat, 9 Oktober 2026 · GOR Uji",
        "Total Rp280.000 · 8 orang",
        "",
        "Transfer ke Raka:",
        "- Dimas Rp35.000",
        "- Sinta Rp35.000 (lunas)",
        "",
        "Rekening Raka:",
        "- BCA 1234567890 a.n. Raka Putra",
        "- GoPay 08123",
        "- QRIS: lihat gambar di tautan",
        "",
        "Rincian & tandai sudah bayar:",
        "https://magerrr.test/s/abc/tagihan",
      ].join("\n"),
    );
  });

  it("tanpa transfer & tanpa rekening", () => {
    const text = billText({
      groupName: "G",
      startsAt: new Date("2026-10-09T12:00:00Z"),
      venue: null,
      total: 0,
      participants: 2,
      transfers: [],
      payTo: [{ name: "Raka", infos: [] }],
      url: "u",
    });
    expect(text).toBe("Tagihan mabar G\nJumat, 9 Oktober 2026\nTotal Rp0 · 2 orang\n\nTidak ada yang perlu transfer.\n\nRincian & tandai sudah bayar:\nu");
  });

  it("whatsappUrl meng-encode teks", () => {
    expect(whatsappUrl("a b\nc&d")).toBe("https://wa.me/?text=a%20b%0Ac%26d");
  });
});
