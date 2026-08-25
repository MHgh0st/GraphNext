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
  const [hour, setHour] = useState<number | undefined>(undefined);
  const [day, setDay] = useState<number | undefined>(undefined);
  const [week, setWeek] = useState<number | undefined>(undefined);

  useEffect(() => {
    const hasWeek = week !== undefined && !isNaN(week);
    const hasDay = day !== undefined && !isNaN(day);
    const hasHour = hour !== undefined && !isNaN(hour);

    if (hasWeek || hasDay || hasHour) {
      const total =
        (hasWeek ? week : 0) * 7 * 24 * 3600 +
        (hasDay ? day : 0) * 24 * 3600 +
        (hasHour ? hour : 0) * 3600;
      setTime(total);
    } else {
      setTime(null);
    }
  }, [week, day, hour, setTime]);

  return (
    <div dir="rtl">
      <p className="mb-2 font-medium text-right">{title}</p>
      <div className="flex gap-x-2">
        <NumberInput
          size="sm"
          placeholder="هفته"
          onValueChange={setWeek}
          value={week}
          minValue={0}
        />
        <NumberInput
          size="sm"
          placeholder="روز"
          onValueChange={setDay}
          value={day}
          minValue={0}
          maxValue={6}
        />
        <NumberInput
          size="sm"
          placeholder="ساعت"
          value={hour}
          onValueChange={setHour}
          minValue={0}
          maxValue={23}
        />
      </div>
    </div>
  );
}
