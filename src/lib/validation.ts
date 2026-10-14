// Skema input (dipakai route handler di server dan form di klien).
import { z } from "zod";
import { MAX_ENTRIES } from "@/lib/core/bracket";
import { TOURNAMENT_FORMATS } from "@/lib/core/tournament";
import { KIKO_ACC, KIKO_FUR, KIKO_HAT, KIKO_JERSEY } from "@/lib/core/mascot";
import { assertValidRules } from "@/lib/core/rules";
import { formatRupiah } from "@/lib/format";
import { SHARE_CHANNELS } from "@/lib/analytics-core";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{32}$/;

export const isUuid = (value: string) => UUID.test(value);
/** invite_code / claim_token: hex 128 bit */
export const isToken = (value: string) => TOKEN.test(value);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi.")
  .max(40, "Nama maksimal 40 karakter.");

const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Nama grup wajib diisi.")
  .max(60, "Nama grup maksimal 60 karakter.");

const emojiSchema = z
  .string()
  .trim()
  .max(16, "Ikon terlalu panjang.")
  .nullish()
  .transform((v) => v || null);

export const groupCreateSchema = z.object({ name: groupNameSchema, emoji: emojiSchema }).strict();

export const rulesSchema = z
  .object({
    target: z.int("Target harus bilangan bulat.").min(5, "Target minimal 5.").max(99, "Target maksimal 99."),
    deuce: z.boolean(),
    cap: z.int("Batas harus bilangan bulat.").min(5).max(99, "Batas maksimal 99."),
  })
  .strict()
  .transform((r) => (r.deuce ? r : { ...r, cap: r.target }))
  .superRefine((r, ctx) => {
    try {
      assertValidRules(r);
    } catch {
      ctx.addIssue({ code: "custom", path: ["cap"], message: "Batas maksimum harus ≥ target." });
    }
  });

const points = z.int("Poin harus bilangan bulat.").min(0, "Poin minimal 0.").max(10, "Poin maksimal 10.");

export const scoringSchema = z
  .object({
    winPoints: points,
    lossPoints: points,
    lossBonus: z
      .object({
        maxMargin: z.int().min(1, "Selisih minimal 1.").max(50, "Selisih maksimal 50."),
        points: z.int().min(1, "Bonus minimal 1.").max(10, "Bonus maksimal 10."),
      })
      .strict()
      .nullable(),
    minMatches: z.int().min(0, "Minimal 0.").max(100, "Maksimal 100."),
  })
  .strict();

export const MATCH_GAMES = [1, 3, 5] as const;
export const ROUND_TO = [1, 500, 1000] as const;
/** Mode main yang ditawarkan (round_robin P2 belum). */
export const PLAY_MODES = ["kocok", "rotasi", "fix_pasangan"] as const;

export const groupSettingsSchema = z
  .object({
    name: groupNameSchema,
    emoji: emojiSchema,
    rules: rulesSchema,
    matchGames: z.union(MATCH_GAMES.map((n) => z.literal(n))),
    scoring: scoringSchema,
    roundTo: z.union(ROUND_TO.map((n) => z.literal(n))),
    defaultPlayMode: z.enum(PLAY_MODES),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Tidak ada perubahan.");
export type GroupSettingsPatch = z.infer<typeof groupSettingsSchema>;

export const memberCreateSchema = z.object({ displayName: displayNameSchema }).strict();

export const memberUpdateSchema = z
  .object({
    grade: z.enum(["A", "B", "C", "D"]).nullable(),
    role: z.enum(["admin", "member"]),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Tidak ada perubahan.");
export type MemberPatch = z.infer<typeof memberUpdateSchema>;

const uuidSchema = z.string().regex(UUID, "Id tidak valid.");
const rupiahSchema = z.int("Nominal harus bilangan bulat.").min(0, "Nominal minimal 0.").max(100_000_000, "Nominal terlalu besar.");
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => v || null);

/** Detail sesi (PRD S1). Tanggal & jam diisi sebagai waktu dinding WIB. */
const sessionDetailsShape = {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam tidak valid."),
  durationMin: z.int().min(30, "Durasi minimal 30 menit.").max(720, "Durasi maksimal 12 jam."),
  venue: optionalText(80, "Nama tempat maksimal 80 karakter."),
  courtCount: z.int().min(1, "Minimal 1 lapangan.").max(12, "Maksimal 12 lapangan."),
  playMode: z.enum(PLAY_MODES),
  /** null = ikut aturan grup */
  rules: rulesSchema.nullable(),
  matchGames: z.union(MATCH_GAMES.map((n) => z.literal(n))).nullable(),
  note: optionalText(500, "Catatan maksimal 500 karakter."),
};

export const sessionCreateSchema = z
  .object({
    ...sessionDetailsShape,
    attendeeIds: z.array(uuidSchema).max(200),
    costs: z
      .object({
        /** tarif sewa per lapangan per jam; total = courtCost() */
        courtPerHour: rupiahSchema.nullable(),
        shuttle: rupiahSchema.nullable(),
      })
      .strict(),
  })
  .strict();
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;

export const sessionUpdateSchema = z.object(sessionDetailsShape).strict();
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>;

export const attendeesSchema = z.object({ memberIds: z.array(uuidSchema).max(200) }).strict();

export const shuttleSchema = z
  .object({
    pricePerSlop: z.int("Harga harus bilangan bulat.").min(0, "Harga minimal Rp0.").max(10_000_000, "Harga terlalu besar.").nullable(),
    perSlop: z.int().min(1, "Isi per slop minimal 1.").max(50, "Isi per slop maksimal 50."),
    used: z.int().min(0, "Minimal 0.").max(999, "Maksimal 999."),
  })
  .strict();

export const fixedPairsSchema = z.union([
  z.object({ auto: z.literal(true) }).strict(),
  z.object({ pairs: z.array(z.tuple([uuidSchema, uuidSchema])).max(100) }).strict(),
]);

export const rsvpSchema = z.object({ rsvp: z.enum(["going", "not_going", "maybe"]) }).strict();

export const sessionStatusSchema = z.object({ status: z.enum(["running", "finished"]) }).strict();

const teamSchema = z.array(uuidSchema).min(1).max(2);
const gameSchema = z.object({ a: z.int().min(0).max(99), b: z.int().min(0).max(99) }).strict();
const kindSchema = z.enum(["doubles", "singles"]);
const courtNoSchema = z.int().min(1, "Nomor lapangan tidak valid.").max(12, "Nomor lapangan tidak valid.");
const seedSchema = z.int().min(0).max(2_147_483_647);

export const planSchema = z.object({ kind: kindSchema, seed: seedSchema }).strict();

export const startRoundSchema = z
  .object({
    matches: z.array(z.object({ courtNo: courtNoSchema, kind: kindSchema, A: teamSchema, B: teamSchema }).strict()).min(1).max(12),
    seed: seedSchema.nullable(),
    queue: z.array(uuidSchema).max(200).nullable(),
  })
  .strict();
export type StartRoundInput = z.infer<typeof startRoundSchema>;

export const liveScoreSchema = z.object({ games: z.array(gameSchema).min(1).max(5) }).strict();

/** Pencatat skor lapangan: anggota, atau null = kembali ke admin. */
export const courtScorerSchema = z.object({ memberId: uuidSchema.nullable() }).strict();

export const matchResultSchema = z
  .object({ kind: kindSchema, courtNo: courtNoSchema.nullable(), A: teamSchema, B: teamSchema, games: z.array(gameSchema).min(1).max(5) })
  .strict();
export type MatchResultInput = z.infer<typeof matchResultSchema>;

/** Preset biaya badminton (PRD P1); hanya pintasan nama, biaya kustom tetap bebas. */
export const EXPENSE_PRESETS = ["court", "shuttle", "drink", "parking"] as const;
export type ExpensePreset = (typeof EXPENSE_PRESETS)[number];

const shareAmountSchema = z.int("Nominal harus bilangan bulat.").min(0, "Nominal minimal 0.").max(100_000_000, "Nominal terlalu besar.");
const weightSchema = z.int("Bobot harus bilangan bulat.").min(0, "Bobot minimal 0.").max(100_000, "Bobot terlalu besar.");
const memberRecord = <T extends z.ZodType>(value: T) =>
  z.record(uuidSchema, value).refine((r) => Object.keys(r).length > 0, "Pilih minimal satu peserta.").refine((r) => Object.keys(r).length <= 200, "Peserta terlalu banyak.");

/**
 * Cara bagi biaya (PRD P2): `all` = rata ke semua peserta hadir (ikut kehadiran), `equal` = rata ke
 * peserta terpilih, `custom` = nominal per orang, `weighted` = sebanding bobot (mis. menit main).
 */
export const splitSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }).strict(),
  z.object({ mode: z.literal("equal"), members: z.array(uuidSchema).min(1, "Pilih minimal satu peserta.").max(200) }).strict(),
  z.object({ mode: z.literal("custom"), shares: memberRecord(shareAmountSchema) }).strict(),
  z.object({ mode: z.literal("weighted"), weights: memberRecord(weightSchema) }).strict(),
]);
export type SplitInput = z.infer<typeof splitSchema>;

export const expenseSchema = z
  .object({
    name: z.string().trim().min(1, "Nama biaya wajib diisi.").max(60, "Nama biaya maksimal 60 karakter."),
    amount: z.int("Nominal harus bilangan bulat.").min(1, "Nominal minimal Rp1.").max(100_000_000, "Nominal terlalu besar."),
    paidBy: uuidSchema,
    preset: z.enum(EXPENSE_PRESETS).nullable(),
    split: splitSchema,
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.split.mode === "custom") {
      const total = Object.values(e.split.shares).reduce((s, v) => s + v, 0);
      if (total !== e.amount) {
        ctx.addIssue({
          code: "custom",
          path: ["split", "shares"],
          message: `Jumlah bagian (${formatRupiah(total)}) harus sama dengan nominal biaya (${formatRupiah(e.amount)}).`,
        });
      }
    }
    if (e.split.mode === "weighted" && Object.values(e.split.weights).every((w) => w === 0)) {
      ctx.addIssue({ code: "custom", path: ["split", "weights"], message: "Total bobot harus lebih dari 0." });
    }
  });
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const paymentActionSchema = z.object({ action: z.enum(["paid", "unpaid", "reject"]) }).strict();

const optionalField = (max: number, message: string) => z.string().trim().max(max, message).transform((v) => v || null);

export const paymentInfoSchema = z
  .object({
    kind: z.enum(["bank", "ewallet"]),
    label: z.string().trim().min(1, "Nama bank / e-wallet wajib diisi.").max(40, "Maksimal 40 karakter."),
    accountNo: z
      .string()
      .trim()
      .min(1, "Nomor rekening / HP wajib diisi.")
      .max(40, "Maksimal 40 karakter.")
      .regex(/^[0-9 .-]+$/, "Nomor hanya boleh berisi angka, spasi, titik, atau tanda hubung."),
    accountName: optionalField(60, "Nama pemilik maksimal 60 karakter."),
  })
  .strict();
export type PaymentInfoInput = z.infer<typeof paymentInfoSchema>;

export const qrisLabelSchema = z.string().trim().max(40, "Maksimal 40 karakter.").transform((v) => v || "QRIS");

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");

export const seasonSchema = z
  .object({
    name: z.string().trim().min(1, "Nama musim wajib diisi.").max(60, "Nama musim maksimal 60 karakter."),
    startsOn: dateSchema,
    endsOn: dateSchema.nullable(),
  })
  .strict()
  .refine((s) => s.endsOn === null || s.endsOn >= s.startsOn, { path: ["endsOn"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai." });
export type SeasonInput = z.infer<typeof seasonSchema>;

export const recapSettingsSchema = z.object({ public: z.boolean() }).strict();

/** Event bagikan dari klien; sesi dikenali lewat token halaman publiknya. */
export const shareEventSchema = z
  .object({
    event: z.enum(["bill_shared", "recap_shared"]),
    token: z.string().regex(TOKEN, "Token tidak valid."),
    channel: z.enum(SHARE_CHANNELS),
  })
  .strict();

export const joinSchema = z.object({ displayName: displayNameSchema }).strict();

/** Kostum Kiko; null = kembali ke kostum otomatis sesuai level. */
export const kikoOutfitSchema = z
  .object({
    outfit: z
      .object({ fur: z.enum(KIKO_FUR), hat: z.enum(KIKO_HAT), acc: z.enum(KIKO_ACC), jersey: z.enum(KIKO_JERSEY) })
      .strict()
      .nullable(),
  })
  .strict();

/**
 * Turnamen di sesi: sistem gugur (bawaan), round robin, atau grup + gugur (`groups` wajib). Peserta tunggal,
 * ganda dipasangkan otomatis, atau pasangan manual.
 */
export const tournamentCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Nama turnamen wajib diisi.").max(60, "Nama turnamen maksimal 60 karakter."),
    seeding: z.enum(["rating", "random"]),
    format: z.enum(TOURNAMENT_FORMATS).default("knockout"),
    groups: z
      .object({ count: z.union([z.literal(2), z.literal(4), z.literal(8)]), advance: z.union([z.literal(1), z.literal(2)]) })
      .strict()
      .nullable()
      .default(null),
    entries: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("singles"), memberIds: z.array(uuidSchema).min(2, "Pilih minimal 2 pemain.").max(MAX_ENTRIES, `Maksimal ${MAX_ENTRIES} pemain.`) }).strict(),
      z.object({ mode: z.literal("pairs_auto"), memberIds: z.array(uuidSchema).min(4, "Pilih minimal 4 pemain (2 pasangan).").max(MAX_ENTRIES * 2, `Maksimal ${MAX_ENTRIES} pasangan.`) }).strict(),
      z.object({ mode: z.literal("pairs"), pairs: z.array(z.tuple([uuidSchema, uuidSchema])).min(2, "Minimal 2 pasangan.").max(MAX_ENTRIES, `Maksimal ${MAX_ENTRIES} pasangan.`) }).strict(),
    ]),
  })
  .strict()
  .refine((v) => (v.format === "groups_knockout") === (v.groups !== null), {
    message: "Jumlah grup & yang lolos hanya diisi untuk format grup + gugur.",
    path: ["groups"],
  });
export type TournamentCreateInput = z.infer<typeof tournamentCreateSchema>;

/** Mulai match turnamen: slot bagan gugur, atau pasangan seed round robin / grup (a < b). */
export const tournamentStartSchema = z.union([
  z.object({ round: z.int().min(1).max(5), slot: z.int().min(0).max(15), courtNo: courtNoSchema }).strict(),
  z
    .object({ a: z.int().min(1).max(MAX_ENTRIES), b: z.int().min(1).max(MAX_ENTRIES), courtNo: courtNoSchema })
    .strict()
    .refine((v) => v.a < v.b, { message: "Pasangan seed tidak sah.", path: ["b"] }),
]);
export type TournamentStartInput = z.infer<typeof tournamentStartSchema>;

export const CHAT_MAX_LENGTH = 1000;

/** Isi pesan obrolan: spasi di ujung dibuang, baris kosong berturut-turut maksimal satu. */
export const chatMessageSchema = z
  .object({
    body: z
      .string()
      .transform((v) => v.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
      .pipe(z.string().min(1, "Pesan kosong.").max(CHAT_MAX_LENGTH, `Pesan maksimal ${CHAT_MAX_LENGTH} karakter.`)),
  })
  .strict();

/** Cursor polling obrolan: id pesan (bilangan bulat ≥ 0) dari query string; selain itu null. */
export function chatCursor(value: string | null): number | null {
  if (value === null || !/^\d{1,15}$/.test(value)) return null;
  return Number(value);
}

/** Tujuan redirect setelah login: hanya path relatif di situs ini. */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
