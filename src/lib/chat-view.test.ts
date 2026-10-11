import { describe, expect, it } from "vitest";
import { chatItems, mergeMessages, type ChatMessage } from "./chat-view";

const msg = (id: number, memberId: string, createdAt: string, body: string | null = `pesan ${id}`): ChatMessage => ({
  id,
  memberId,
  name: memberId.toUpperCase(),
  body,
  createdAt,
});

describe("chatItems", () => {
  // Sabtu 10 Okt 2026 20.00 WIB
  const now = new Date("2026-10-10T13:00:00Z");

  it("pemisah hari WIB: tanggal lama, Kemarin, Hari ini", () => {
    const items = chatItems(
      [
        msg(1, "a", "2026-10-08T10:00:00Z"),
        // 9 Okt 23.30 WIB
        msg(2, "a", "2026-10-09T16:30:00Z"),
        // 10 Okt 00.10 WIB — hari berganti walau selisih 40 menit
        msg(3, "a", "2026-10-09T17:10:00Z"),
      ],
      "a",
      now,
    );
    expect(items.filter((i) => i.type === "day").map((i) => i.label)).toEqual(["Kamis, 8 Oktober 2026", "Kemarin", "Hari ini"]);
    expect(items.filter((i) => i.type === "message").map((i) => i.type === "message" && i.showName)).toEqual([true, true, true]);
  });

  it("pesan beruntun ≤ 5 menit dari pengirim sama tidak mengulang nama", () => {
    const items = chatItems(
      [
        msg(1, "a", "2026-10-10T12:00:00Z"),
        msg(2, "a", "2026-10-10T12:04:00Z"),
        msg(3, "b", "2026-10-10T12:05:00Z"),
        msg(4, "a", "2026-10-10T12:06:00Z"),
        msg(5, "a", "2026-10-10T12:12:00Z"),
      ],
      "b",
      now,
    ).filter((i) => i.type === "message");
    expect(items.map((i) => i.type === "message" && [i.message.id, i.showName, i.mine, i.time])).toEqual([
      [1, true, false, "19.00"],
      [2, false, false, "19.04"],
      [3, true, true, "19.05"],
      [4, true, false, "19.06"],
      [5, true, false, "19.12"],
    ]);
  });
});

describe("mergeMessages", () => {
  it("tanpa duplikat, urut id, penghapusan mengosongkan isi", () => {
    const merged = mergeMessages([msg(2, "a", "2026-10-10T12:00:00Z"), msg(3, "b", "2026-10-10T12:01:00Z")], [msg(3, "b", "2026-10-10T12:01:00Z"), msg(1, "a", "2026-10-10T11:00:00Z"), msg(4, "a", "2026-10-10T12:02:00Z")], [2, 99]);
    expect(merged.map((m) => [m.id, m.body])).toEqual([
      [1, "pesan 1"],
      [2, null],
      [3, "pesan 3"],
      [4, "pesan 4"],
    ]);
  });
});
