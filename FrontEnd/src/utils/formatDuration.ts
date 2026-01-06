/**
 * @module utils/formatDuration
 * @description Utility for formatting duration values in Persian
 */

/**
 * Formats a duration in seconds to a human-readable Persian string.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string with appropriate unit (ثانیه/دقیقه/ساعت/روز)
 *
 * @example
 * ```ts
 * formatDuration(45) // "45 ثانیه"
 * formatDuration(150) // "2.5 دقیقه"
 * formatDuration(7200) // "2.0 ساعت"
 * formatDuration(172800) // "2.00 روز"
 * ```
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)} ثانیه`;
  } else if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)} دقیقه`;
  } else if (seconds < 86400) {
    return `${(seconds / 3600).toFixed(1)} ساعت`;
  }
  return `${(seconds / 86400).toFixed(2)} روز`;
}
