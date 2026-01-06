import { useState, useEffect } from "react";
import { NumberInput } from "@heroui/number-input";
interface TimeFilterSectionProps {
  title: string;
  setTime: (value: number | null) => void;
}

export default function TimeFilterSection({
  title,
  setTime,
}: TimeFilterSectionProps) {
  const [hour, setHour] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const changeDate = (
    e: number | React.ChangeEvent<HTMLInputElement>,
    setFn: (value: number) => void
  ) => {
    const value =
      typeof e === "number" ? e : parseInt(e.target.value || "0", 10);

    setFn(value);
  };

  useEffect(() => {
    if (week !== null || day !== null || hour !== null) {
      const total =
        (week ?? 0) * 7 * 24 * 3600 +
        (day ?? 0) * 24 * 3600 +
        (hour ?? 0) * 3600;
      setTime(total);
    } else {
      setTime(null);
    }
  }, [week, day, hour]);
  return (
    <div dir="rtl">
      <p className="mb-2 font-medium text-right">{title}</p>
      <div className="flex gap-x-2">
        <NumberInput
          size="sm"
          placeholder="هفته"
          onChange={(value) => changeDate(value, setWeek)}
          value={week}
          minValue={0}
        />
        <NumberInput
          size="sm"
          placeholder="روز"
          onChange={(value) => changeDate(value, setDay)}
          value={day}
          minValue={0}
          maxValue={6}
        />
        <NumberInput
          size="sm"
          placeholder="ساعت"
          value={hour}
          onChange={(value) => changeDate(value, setHour)}
          minValue={0}
          maxValue={23}
        />
      </div>
    </div>
  );
}
