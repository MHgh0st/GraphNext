"use client";
import { addToast } from "@heroui/toast";
import { SquareCheck, CircleX } from "lucide-react";

/**
 * Imperatively show a toast notification.
 * Can be called from anywhere — React components or plain TS utility modules.
 */
export function showToast({
  title,
  message,
  type,
}: {
  title?: string;
  message: string;
  type: "success" | "error";
}) {
  addToast({
    title: title ?? (type === "success" ? "عملیات با موفقیت انجام شد" : "خطایی رخ داد!"),
    description: message,
    color: type === "success" ? "success" : "danger",
    timeout: 4000,
    variant: "flat",
    shouldShowTimeoutProgress: true,
    icon: type === "success" ? <SquareCheck size={20} /> : <CircleX size={20} />,
  });
}

/** @deprecated Use the named export `showToast` instead. */
export default function Toast(props: Parameters<typeof showToast>[0]) {
  showToast(props);
}
