// src/constants/colorPalettes.ts
import { scaleLinear } from "d3-scale";

// تابعی که یک وزن را بر اساس حداقل و حداکثر وزن، به یک رنگ مپ می‌کند
type ColorScaleFn = (
  weight: number,
  minWeight: number,
  maxWeight: number
) => string;

// تعریف پالت‌های رنگی
export const colorPalettes: Record<string, ColorScaleFn> = {
  default: (weight, minWeight, maxWeight) => {
    // طیف سبز به بنفش
    const scale = scaleLinear<string>()
      .domain([minWeight, maxWeight])
      .range(["#c4dafc", "#3b82f6"]);
    return scale(weight);
  }, // رنگ آبی ثابت فعلی شما

  palette1: (weight, minWeight, maxWeight) => {
    // طیف سبز به بنفش
    const scale = scaleLinear<string>()
      .domain([minWeight, maxWeight])
      .range(["#d9f0a3", "#4d004b"]);
    return scale(weight);
  },

  palette2: (weight, minWeight, maxWeight) => {
    // طیف آبی به قرمز (مناسب برای نشان دادن سرما/گرما)
    const scale = scaleLinear<string>()
      .domain([minWeight, maxWeight])
      .range(["#4575b4", "#d73027"]);
    return scale(weight);
  },

  palette3: (weight, minWeight, maxWeight) => {
    // طیف خاکستری
    const scale = scaleLinear<string>()
      .domain([minWeight, maxWeight])
      .range(["#f0f0f0", "#000000"]);
    return scale(weight);
  },
  palette4: (weight, minWeight, maxWeight) => {
    // طیف آبی (از روشن به تیره)
    const scale = scaleLinear<string>()
      .domain([minWeight, maxWeight])
      .range(["#deebf7", "#08306b"]);
    return scale(weight);
  },
  // ... می‌توانید پالت‌های بیشتری اضافه کنید
};

// گزینه‌هایی که در منوی Select نمایش داده می‌شوند
export const paletteOptions = [
  {
    key: "default",
    label: "پیش‌فرض (آبی)",
    gradient: "linear-gradient(to right, #c4dafc, #3b82f6)",
  },
  {
    key: "palette1",
    label: "طیف ۱ (سبز به بنفش)",
    gradient: "linear-gradient(to right, #d9f0a3, #4d004b)",
  },
  {
    key: "palette2",
    label: "طیف ۲ (آبی به قرمز)",
    gradient: "linear-gradient(to right, #4575b4, #d73027)",
  },
  {
    key: "palette3",
    label: "طیف ۳ (خاکستری)",
    gradient: "linear-gradient(to right, #f0f0f0, #000000)",
  },
  {
    key: "palette4",
    label: "طیف ۴ (آبی‌ها)",
    gradient: "linear-gradient(to right, #deebf7, #08306b)",
  },
];
