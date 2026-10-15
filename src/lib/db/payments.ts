import "server-only";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http-error";
import { imageType } from "@/lib/image-type";
import type { PaymentInfoInput } from "@/lib/validation";
import { serviceClient } from "./supabase";

/** Info pembayaran anggota (PRD P6): rekening bank, e-wallet, atau gambar QRIS. */
export interface PaymentInfo {
  id: string;
  memberId: string;
  kind: "bank" | "ewallet" | "qris";
  label: string;
  accountNo: string | null;
  accountName: string | null;
  hasQr: boolean;
}

export const QRIS_BUCKET = "qris";
const BUCKET = QRIS_BUCKET;
const MAX_INFOS = 5;
export const MAX_QRIS_BYTES = 2 * 1024 * 1024;
const COLUMNS = "id, member_id, kind, label, account_no, account_name, qr_image_path" as const;

type Row = {
  id: string;
  member_id: string;
  kind: string;
  label: string;
  account_no: string | null;
  account_name: string | null;
  qr_image_path: string | null;
};

const toInfo = (r: Row): PaymentInfo => ({
  id: r.id,
  memberId: r.member_id,
  kind: r.kind as PaymentInfo["kind"],
  label: r.label,
  accountNo: r.account_no,
  accountName: r.account_name,
  hasQr: r.qr_image_path !== null,
});

/** Panggil hanya untuk anggota yang boleh dilihat pemanggil (grup sendiri / penerima di tagihan publik). */
export async function listPaymentInfos(memberIds: string[]): Promise<PaymentInfo[]> {
  if (memberIds.length === 0) return [];
  const { data, error } = await serviceClient()
    .from("payment_infos")
    .select(COLUMNS)
    .in("member_id", [...new Set(memberIds)])
    .order("created_at");
  if (error) throw error;
  return data.map(toInfo);
}

async function assertRoom(memberId: string): Promise<void> {
  const { count, error } = await serviceClient()
    .from("payment_infos")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);
  if (error) throw error;
  if ((count ?? 0) >= MAX_INFOS) throw new HttpError(422, `Maksimal ${MAX_INFOS} info pembayaran. Hapus salah satu dulu.`);
}

export async function addPaymentInfo(memberId: string, input: PaymentInfoInput): Promise<PaymentInfo> {
  await assertRoom(memberId);
  const { data, error } = await serviceClient()
    .from("payment_infos")
    .insert({ member_id: memberId, kind: input.kind, label: input.label, account_no: input.accountNo, account_name: input.accountName })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toInfo(data);
}

export async function addQris(groupId: string, memberId: string, label: string, file: File): Promise<PaymentInfo> {
  if (file.size === 0) throw new HttpError(422, "Pilih gambar QRIS.");
  if (file.size > MAX_QRIS_BYTES) throw new HttpError(422, "Gambar QRIS maksimal 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) throw new HttpError(422, "Gambar QRIS harus PNG, JPG, atau WebP.");
  await assertRoom(memberId);

  const db = serviceClient();
  const path = `${groupId}/${memberId}/${randomUUID()}.${type.split("/")[1]}`;
  const upload = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) throw upload.error;
  const { data, error } = await db
    .from("payment_infos")
    .insert({ member_id: memberId, kind: "qris", label, qr_image_path: path })
    .select(COLUMNS)
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return toInfo(data);
}

export async function deletePaymentInfo(memberId: string, infoId: string): Promise<void> {
  const db = serviceClient();
  const { data, error } = await db
    .from("payment_infos")
    .delete()
    .eq("id", infoId)
    .eq("member_id", memberId)
    .select("qr_image_path");
  if (error) throw error;
  if (data.length === 0) throw new HttpError(404, "Info pembayaran tidak ditemukan.");
  const path = data[0].qr_image_path;
  if (path) await db.storage.from(BUCKET).remove([path]);
}

/** Gambar QRIS milik salah satu `allowedMemberIds`, atau null. */
export async function readQris(infoId: string, allowedMemberIds: string[]): Promise<Blob | null> {
  if (allowedMemberIds.length === 0) return null;
  const db = serviceClient();
  const { data, error } = await db
    .from("payment_infos")
    .select("qr_image_path")
    .eq("id", infoId)
    .in("member_id", allowedMemberIds)
    .maybeSingle();
  if (error) throw error;
  if (!data?.qr_image_path) return null;
  const file = await db.storage.from(BUCKET).download(data.qr_image_path);
  if (file.error) throw file.error;
  return file.data;
}

/** Response gambar QRIS (tidak di-cache publik; tautan bisa dicabut). */
export function qrisResponse(blob: Blob | null): Response {
  if (!blob) return Response.json({ error: "Gambar tidak ditemukan." }, { status: 404 });
  return new Response(blob, {
    headers: {
      "content-type": blob.type || "image/png",
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
