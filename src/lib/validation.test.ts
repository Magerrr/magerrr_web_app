import { describe, expect, it } from "vitest";
import {
  accountEmailSchema,
  accountNameSchema,
  chatCursor,
  chatMessageSchema,
  expenseSchema,
  groupCreateSchema,
  groupSettingsSchema,
  isToken,
  isUuid,
  kikoOutfitSchema,
  memberUpdateSchema,
  paymentInfoSchema,
  rulesSchema,
  safeNextPath,
  tournamentCreateSchema,
  tournamentStartSchema,
} from "./validation";

describe("safeNextPath", () => {
  it("hanya menerima path relatif di situs ini", () => {
    expect(safeNextPath("/g/abc?x=1")).toBe("/g/abc?x=1");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(["/a"])).toBe("/");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""]) {
      expect(safeNextPath(bad), bad).toBe("/");
    }
  });
});

describe("rulesSchema", () => {
  it("deuce=false → cap disamakan dengan target", () => {
    expect(rulesSchema.parse({ target: 15, deuce: false, cap: 30 })).toEqual({ target: 15, deuce: false, cap: 15 });
  });

  it("menolak target < 5, pecahan, dan cap < target saat deuce", () => {
    expect(rulesSchema.safeParse({ target: 4, deuce: false, cap: 4 }).success).toBe(false);
    expect(rulesSchema.safeParse({ target: 21.5, deuce: true, cap: 30 }).success).toBe(false);
    const capTooLow = rulesSchema.safeParse({ target: 21, deuce: true, cap: 20 });
    expect(capTooLow.success).toBe(false);
    expect(capTooLow.error?.issues[0].message).toBe("Batas maksimum harus ≥ target.");
  });
});

describe("groupSettingsSchema", () => {
  it("menerima patch sebagian dan menolak field asing atau patch kosong", () => {
    expect(groupSettingsSchema.parse({ matchGames: 3 })).toEqual({ matchGames: 3 });
    expect(groupSettingsSchema.safeParse({}).success).toBe(false);
    expect(groupSettingsSchema.safeParse({ ownerId: "x" }).success).toBe(false);
    expect(groupSettingsSchema.safeParse({ matchGames: 2 }).success).toBe(false);
    expect(groupSettingsSchema.safeParse({ roundTo: 100 }).success).toBe(false);
    expect(groupSettingsSchema.safeParse({ defaultPlayMode: "round_robin" }).success).toBe(false);
  });

  it("scoring: poin integer 0–10, bonus kalah tipis opsional", () => {
    const scoring = { winPoints: 3, lossPoints: 0, lossBonus: { maxMargin: 3, points: 1 }, minMatches: 0 };
    expect(groupSettingsSchema.parse({ scoring })).toEqual({ scoring });
    expect(groupSettingsSchema.safeParse({ scoring: { ...scoring, winPoints: 11 } }).success).toBe(false);
    expect(groupSettingsSchema.safeParse({ scoring: { ...scoring, lossBonus: null } }).success).toBe(true);
  });
});

describe("skema lain", () => {
  it("nama dipangkas; ikon kosong → null", () => {
    expect(groupCreateSchema.parse({ name: "  Mabar  ", emoji: " " })).toEqual({ name: "Mabar", emoji: null });
    expect(groupCreateSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("member update: grade A–D atau null, peran admin/member", () => {
    expect(memberUpdateSchema.parse({ grade: null })).toEqual({ grade: null });
    expect(memberUpdateSchema.safeParse({ grade: "E" }).success).toBe(false);
    expect(memberUpdateSchema.safeParse({ role: "owner" }).success).toBe(false);
  });

  it("format id dan token", () => {
    expect(isUuid("ffb1177b-4e1a-49d8-8524-cd5875572207")).toBe(true);
    expect(isUuid("1; drop table")).toBe(false);
    expect(isToken("0063f326ce5000000000000000000000")).toBe(true);
    expect(isToken("0063F326")).toBe(false);
  });
});

describe("expenseSchema", () => {
  const A = "00000000-0000-4000-8000-00000000000a";
  const B = "00000000-0000-4000-8000-00000000000b";
  const base = { name: " Kok ", amount: 40000, paidBy: A, preset: "shuttle" };
  const message = (input: unknown) => {
    const r = expenseSchema.safeParse(input);
    return r.success ? null : r.error.issues[0]?.message;
  };

  it("menerima keempat cara bagi", () => {
    expect(expenseSchema.parse({ ...base, split: { mode: "all" } }).name).toBe("Kok");
    expect(message({ ...base, split: { mode: "equal", members: [A, B] } })).toBeNull();
    expect(message({ ...base, split: { mode: "custom", shares: { [A]: 30000, [B]: 10000 } } })).toBeNull();
    expect(message({ ...base, split: { mode: "weighted", weights: { [A]: 60, [B]: 0 } } })).toBeNull();
  });

  it("vector §5 #5: custom tak seimbang ditolak dengan pesan jelas", () => {
    expect(message({ ...base, split: { mode: "custom", shares: { [A]: 30000, [B]: 5000 } } })).toBe(
      "Jumlah bagian (Rp35.000) harus sama dengan nominal biaya (Rp40.000).",
    );
  });

  it("menolak nominal desimal / nol, bobot nol semua, peserta kosong, id tak valid", () => {
    expect(message({ ...base, amount: 1.5, split: { mode: "all" } })).toBe("Nominal harus bilangan bulat.");
    expect(message({ ...base, amount: 0, split: { mode: "all" } })).toBe("Nominal minimal Rp1.");
    expect(message({ ...base, split: { mode: "weighted", weights: { [A]: 0 } } })).toBe("Total bobot harus lebih dari 0.");
    expect(message({ ...base, split: { mode: "equal", members: [] } })).toBe("Pilih minimal satu peserta.");
    expect(message({ ...base, split: { mode: "custom", shares: {} } })).toBe("Pilih minimal satu peserta.");
    expect(message({ ...base, paidBy: "x", split: { mode: "all" } })).toBe("Id tidak valid.");
    expect(message({ ...base, preset: "escrow", split: { mode: "all" } })).not.toBeNull();
  });
});

describe("paymentInfoSchema", () => {
  it("rekening valid; atas nama opsional", () => {
    expect(paymentInfoSchema.parse({ kind: "bank", label: "BCA", accountNo: "123 456-7", accountName: "" })).toEqual({
      kind: "bank",
      label: "BCA",
      accountNo: "123 456-7",
      accountName: null,
    });
  });

  it("menolak nomor berisi huruf & QRIS lewat JSON", () => {
    expect(paymentInfoSchema.safeParse({ kind: "bank", label: "BCA", accountNo: "abc", accountName: "" }).success).toBe(false);
    expect(paymentInfoSchema.safeParse({ kind: "qris", label: "QRIS", accountNo: "1", accountName: "" }).success).toBe(false);
  });
});

describe("skema maskot, turnamen, obrolan", () => {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  it("kostum Kiko: hanya kunci yang dikenal; null = otomatis", () => {
    expect(kikoOutfitSchema.parse({ outfit: null })).toEqual({ outfit: null });
    expect(kikoOutfitSchema.parse({ outfit: { fur: "abu", hat: "cap", acc: "ball", jersey: "hijau" } }).outfit?.hat).toBe("cap");
    expect(kikoOutfitSchema.safeParse({ outfit: { fur: "#ff0000", hat: "cap", acc: "ball", jersey: "hijau" } }).success).toBe(false);
    expect(kikoOutfitSchema.safeParse({ outfit: { fur: "abu", hat: "cap", acc: "ball" } }).success).toBe(false);
  });

  it("turnamen: tiga cara isi peserta, batas jumlah", () => {
    expect(tournamentCreateSchema.parse({ name: " Cup ", seeding: "rating", entries: { mode: "singles", memberIds: [id(1), id(2)] } }).name).toBe("Cup");
    expect(tournamentCreateSchema.safeParse({ name: "Cup", seeding: "rating", entries: { mode: "pairs_auto", memberIds: [id(1), id(2)] } }).success).toBe(false);
    expect(tournamentCreateSchema.safeParse({ name: "Cup", seeding: "random", entries: { mode: "pairs", pairs: [[id(1), id(2)], [id(3), id(4)]] } }).success).toBe(true);
    expect(tournamentCreateSchema.safeParse({ name: "", seeding: "rating", entries: { mode: "singles", memberIds: [id(1), id(2)] } }).success).toBe(false);
    expect(tournamentCreateSchema.safeParse({ name: "Cup", seeding: "rating", entries: { mode: "singles", memberIds: Array.from({ length: 33 }, (_, i) => id(i)) } }).success).toBe(false);
    expect(tournamentStartSchema.safeParse({ round: 1, slot: 16, courtNo: 1 }).success).toBe(false);
    expect(tournamentCreateSchema.parse({ name: "Cup", seeding: "rating", entries: { mode: "singles", memberIds: [id(1), id(2)] } })).toMatchObject({ format: "knockout", groups: null });
    const groups = { name: "Cup", seeding: "rating", format: "groups_knockout", entries: { mode: "singles", memberIds: [id(1), id(2), id(3), id(4)] } };
    expect(tournamentCreateSchema.safeParse({ ...groups, groups: { count: 2, advance: 1 } }).success).toBe(true);
    expect(tournamentCreateSchema.safeParse(groups).success).toBe(false); // grup wajib
    expect(tournamentCreateSchema.safeParse({ ...groups, groups: { count: 3, advance: 1 } }).success).toBe(false);
    expect(tournamentCreateSchema.safeParse({ ...groups, format: "round_robin", groups: { count: 2, advance: 1 } }).success).toBe(false);
    expect(tournamentCreateSchema.safeParse({ ...groups, format: "swiss" }).success).toBe(false);
    expect(tournamentStartSchema.safeParse({ a: 1, b: 3, courtNo: 2 }).success).toBe(true);
    expect(tournamentStartSchema.safeParse({ a: 3, b: 1, courtNo: 2 }).success).toBe(false);
    expect(tournamentStartSchema.safeParse({ a: 1, b: 3, round: 1, courtNo: 2 }).success).toBe(false);
  });

  it("pesan obrolan dirapikan; kosong / terlalu panjang ditolak", () => {
    expect(chatMessageSchema.parse({ body: "  halo\r\n\r\n\r\n\r\nsemua  " }).body).toBe("halo\n\nsemua");
    expect(chatMessageSchema.safeParse({ body: " \n " }).success).toBe(false);
    expect(chatMessageSchema.safeParse({ body: "x".repeat(1001) }).success).toBe(false);
    expect(chatMessageSchema.parse({ body: "x".repeat(1000) }).body).toHaveLength(1000);
  });

  it("cursor obrolan", () => {
    expect(chatCursor("42")).toBe(42);
    expect(chatCursor("0")).toBe(0);
    for (const bad of [null, "", "-1", "1.5", "1e3", "abc", "9".repeat(16)]) expect(chatCursor(bad)).toBeNull();
  });
});

describe("profil akun (MAGERRR-12)", () => {
  it("nama dipangkas, 1–40 karakter, flag grup wajib", () => {
    expect(accountNameSchema.parse({ displayName: "  Budi ", applyToGroups: true })).toEqual({ displayName: "Budi", applyToGroups: true });
    expect(accountNameSchema.safeParse({ displayName: "  ", applyToGroups: true }).success).toBe(false);
    expect(accountNameSchema.safeParse({ displayName: "x".repeat(41), applyToGroups: false }).success).toBe(false);
    expect(accountNameSchema.safeParse({ displayName: "Budi" }).success).toBe(false);
  });

  it("email dipangkas & huruf kecil; tidak valid ditolak", () => {
    expect(accountEmailSchema.parse({ email: "  Budi@Example.COM " }).email).toBe("budi@example.com");
    for (const bad of ["", "budi", "budi@", "@example.com"]) expect(accountEmailSchema.safeParse({ email: bad }).success).toBe(false);
    expect(accountEmailSchema.safeParse({ email: "a@b.co", extra: 1 }).success).toBe(false);
  });
});
