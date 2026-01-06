import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@heroui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Select, SelectItem } from "@heroui/select";
import { motion, AnimatePresence } from "framer-motion";
import moment from "moment-jalaali";
import { CalendarDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { cn } from "@heroui/theme";
import { Calendar as CalendarIcon, X, ArrowDown, CalendarDays, Clock } from "lucide-react";

// تنظیمات مومنت
moment.loadPersian({ dialect: "persian-modern", usePersianDigits: false });

// ------------------- Types & Constants -------------------

interface DateRange {
  start: DateValue | null;
  end: DateValue | null;
}

interface PersianRangeDatePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  className?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  placeholder?: { start: string; end: string };
}

const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

const PERSIAN_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const PRESETS = [
  { label: "هفته اخیر", days: 7 },
  { label: "۱ ماه اخیر", days: 30 },
  { label: "۳ ماه اخیر", days: 90 },
  { label: "۶ ماه اخیر", days: 180 },
  { label: "یک سال اخیر", days: 365 },
];

// ------------------- Helpers -------------------

const dateToDateValue = (date: Date): DateValue => {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

const dateValueToDate = (dateValue: DateValue): Date => {
  return new Date(dateValue.year, dateValue.month - 1, dateValue.day);
};

const formatPersianDate = (dateValue: DateValue | null) => {
  if (!dateValue) return "";
  const date = dateValueToDate(dateValue);
  return moment(date).format("jYYYY/jMM/jDD");
};

// ------------------- Single Date Picker Component -------------------

interface SinglePersianDatePickerProps {
  label: string;
  value: DateValue | null;
  onChange: (date: DateValue | null) => void;
  minDate?: DateValue | null;
  maxDate?: DateValue | null;
  placeholder?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
}

const SinglePersianDatePicker: React.FC<SinglePersianDatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "انتخاب تاریخ",
  isDisabled = false,
  isRequired = false,
  isInvalid = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(new Date());

  useEffect(() => {
    if (isOpen && value) {
      setViewDate(dateValueToDate(value));
    }
  }, [isOpen, value]);

  const currentJYear = moment().jYear();
  const years = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
    value: String(currentJYear - i + 1),
    label: String(currentJYear - i + 1),
  })), [currentJYear]);

  const months = useMemo(() => PERSIAN_MONTHS.map((name, index) => ({
    value: String(index),
    label: name,
  })), []);

  const calendarDays = useMemo(() => {
    const jMonth = moment(viewDate).jMonth();
    const jYear = moment(viewDate).jYear();
    const firstDay = moment(`${jYear}/${jMonth + 1}/1`, "jYYYY/jM/jD");
    const startDayOfWeek = (firstDay.day() + 1) % 7;
    const daysInMonth = moment.jDaysInMonth(jYear, jMonth);
    const days: Date[] = [];
    const prevMonth = moment(firstDay).subtract(1, "jMonth");
    const daysInPrevMonth = moment.jDaysInMonth(prevMonth.jYear(), prevMonth.jMonth());

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push(moment(`${prevMonth.jYear()}/${prevMonth.jMonth() + 1}/${daysInPrevMonth - i}`, "jYYYY/jM/jD").toDate());
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(moment(`${jYear}/${jMonth + 1}/${i}`, "jYYYY/jM/jD").toDate());
    }
    const remainingDays = 42 - days.length;
    const nextMonth = moment(firstDay).add(1, "jMonth");
    for (let i = 1; i <= remainingDays; i++) {
      days.push(moment(`${nextMonth.jYear()}/${nextMonth.jMonth() + 1}/${i}`, "jYYYY/jM/jD").toDate());
    }
    return days;
  }, [viewDate]);

  const handleDateSelect = (date: Date) => {
    onChange(dateToDateValue(date));
    setIsOpen(false);
  };

  const handleMonthChange = (keys: any) => {
    const selectedMonth = parseInt(Array.from(keys)[0] as string);
    const newDate = moment(viewDate).jMonth(selectedMonth).toDate();
    setViewDate(newDate);
  };

  const handleYearChange = (keys: any) => {
    const selectedYear = parseInt(Array.from(keys)[0] as string);
    const newDate = moment(viewDate).jYear(selectedYear).toDate();
    setViewDate(newDate);
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) return true;
    if (minDate) {
      const min = dateValueToDate(minDate);
      min.setHours(0, 0, 0, 0);
      if (date < min) return true;
    }
    if (maxDate) {
      const max = dateValueToDate(maxDate);
      max.setHours(23, 59, 59, 999);
      if (date > max) return true;
    }
    return false;
  };

  const isSameDay = (d1: Date, d2: DateValue | null) => {
    if (!d2) return false;
    const date2 = dateValueToDate(d2);
    return d1.getFullYear() === date2.getFullYear() &&
           d1.getMonth() === date2.getMonth() &&
           d1.getDate() === date2.getDate();
  };

  return (
    <div className="w-full group">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
            {label} {isRequired && <span className="text-rose-500">*</span>}
        </label>
      </div>
      <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom" offset={8}>
        <PopoverTrigger>
          <Button
            variant="flat"
            className={cn(
              "w-full justify-between bg-white border border-slate-200 h-11 text-sm rounded-xl transition-all duration-200 relative overflow-hidden z-10",
              "hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm",
              "data-[focus=true]:border-blue-500 data-[focus=true]:ring-1 data-[focus=true]:ring-blue-200",
              !value && "text-slate-400 font-normal",
              value && "text-slate-800 font-medium",
              isDisabled && "opacity-60 cursor-not-allowed bg-slate-50",
              isInvalid && "border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100"
            )}
            isDisabled={isDisabled}
            startContent={
                <motion.div 
                    initial={false} 
                    animate={{ scale: value ? 1.1 : 1, rotate: value ? 0 : -10 }}
                    className={cn(
                        "transition-colors p-1.5 rounded-lg",
                        value ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400",
                        isInvalid && "bg-rose-100 text-rose-500"
                    )}
                >
                    <CalendarIcon size={16} />
                </motion.div>
            }
            endContent={
              <AnimatePresence>
                {value && !isDisabled && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-rose-500 cursor-pointer transition-colors z-20"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(null);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X size={14} />
                    </motion.div>
                )}
              </AnimatePresence>
            }
          >
            <span className="truncate">{value ? formatPersianDate(value) : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 min-w-[280px] max-w-[320px] w-full border border-slate-100 shadow-xl rounded-2xl overflow-hidden bg-white z-[60]">
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="p-4"
          >
            {/* هدر تقویم */}
            <div className="flex gap-2 mb-4 justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <Select
                size="sm"
                variant="flat"
                className="w-1/2"
                classNames={{ 
                    trigger: "bg-white shadow-sm min-h-8 h-8 rounded-lg border-0",
                    value: "text-xs font-bold text-slate-700"
                }}
                selectedKeys={[String(moment(viewDate).jMonth())]}
                onChange={(e) => handleMonthChange(new Set([e.target.value]))}
                aria-label="ماه"
                disallowEmptySelection
              >
                {months.map((m) => <SelectItem key={m.value} textValue={m.label}>{m.label}</SelectItem>)}
              </Select>
              <Select
                size="sm"
                variant="flat"
                className="w-1/2"
                classNames={{ 
                    trigger: "bg-white shadow-sm min-h-8 h-8 rounded-lg border-0",
                    value: "text-xs font-bold text-slate-700"
                }}
                selectedKeys={[String(moment(viewDate).jYear())]}
                onChange={(e) => handleYearChange(new Set([e.target.value]))}
                aria-label="سال"
                disallowEmptySelection
              >
                {years.map((y) => <SelectItem key={y.value} textValue={y.label}>{y.label}</SelectItem>)}
              </Select>
            </div>

            {/* روزهای هفته */}
            <div className="grid grid-cols-7 mb-2 px-1">
              {PERSIAN_DAYS.map((d, i) => (
                <span key={i} className="text-center text-[10px] font-bold text-slate-400">
                  {d}
                </span>
              ))}
            </div>

            {/* شبکه روزها */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, idx) => {
                const isCurrentMonth = moment(date).jMonth() === moment(viewDate).jMonth();
                const disabled = isDateDisabled(date);
                const selected = isSameDay(date, value);
                const isToday = isSameDay(date, dateToDateValue(new Date()));

                return (
                  <motion.button
                    key={idx}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDateSelect(date)}
                    whileHover={!disabled ? { scale: 1.1 } : {}}
                    whileTap={!disabled ? { scale: 0.9 } : {}}
                    className={cn(
                      "h-8 w-8 text-[11px] rounded-lg flex items-center justify-center transition-colors relative font-medium font-vazir",
                      !isCurrentMonth ? "text-slate-300 opacity-50" : "text-slate-600",
                      disabled 
                        ? "opacity-20 cursor-not-allowed bg-slate-50" 
                        : "hover:bg-blue-50 hover:text-blue-600 cursor-pointer",
                      
                      isToday && !selected && "ring-1 ring-blue-400 text-blue-600 bg-blue-50/30 font-bold",
                      
                      selected && "bg-blue-500 text-white shadow-md shadow-blue-500/30 hover:bg-blue-600 ring-0 font-bold z-10"
                    )}
                  >
                    {moment(date).jDate()}
                    {selected && (
                        <motion.div 
                            layoutId="selected-day-indicator"
                            className="absolute inset-0 rounded-lg bg-blue-500 -z-10"
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

// ------------------- Main Component -------------------

const PersianRangeDatePicker: React.FC<PersianRangeDatePickerProps> = ({
  value,
  onChange,
  className,
  isRequired = false,
  isInvalid = false,
  errorMessage,
  placeholder,
}) => {
  const [range, setRange] = useState<DateRange>({
    start: value?.start || null,
    end: value?.end || null,
  });

  useEffect(() => {
    if (value) {
      setRange({
        start: value.start || null,
        end: value.end || null,
      });
    }
  }, [value]);

  const handleStartChange = (date: DateValue | null) => {
    let newRange = { ...range, start: date };
    if (date && range.end) {
      const startDate = dateValueToDate(date);
      const endDate = dateValueToDate(range.end);
      if (startDate > endDate) {
        newRange.end = null;
      }
    }
    setRange(newRange);
    onChange?.(newRange);
  };

  const handleEndChange = (date: DateValue | null) => {
    const newRange = { ...range, end: date };
    setRange(newRange);
    onChange?.(newRange);
  };

  const handlePresetClick = (days: number) => {
    const today = new Date();
    const startDate = moment().subtract(days, "days").toDate();
    
    const newRange = {
      start: dateToDateValue(startDate),
      end: dateToDateValue(today)
    };

    setRange(newRange);
    onChange?.(newRange);
  };

  const handleClear = () => {
    const newRange: DateRange = { start: null, end: null };
    setRange(newRange);
    onChange?.(newRange);
  };

  return (
    <div className={cn("flex flex-col gap-3 w-full", className)} dir="rtl">
      
      {/* بخش میانبرها (Presets) */}
      <motion.div 
        layout
        className="flex flex-wrap items-center gap-2 p-2 bg-slate-50/80 border border-slate-200/60 rounded-xl shadow-sm"
      >
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 ml-1 shrink-0">
            <Clock size={14} className="text-blue-500" />
            <span className="text-[10px] font-bold text-slate-600 hidden xs:inline">فیلتر سریع:</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5 flex-1">
            {PRESETS.map((preset) => (
            <motion.button
                key={preset.days}
                type="button"
                onClick={() => handlePresetClick(preset.days)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="
                    px-2 py-1 text-[10px] font-medium rounded-lg transition-colors
                    bg-white border border-slate-200 text-slate-600
                    hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm
                "
            >
                {preset.label}
            </motion.button>
            ))}
        </div>

        {/* دکمه پاک کردن */}
        <AnimatePresence>
            {(range.start || range.end) && (
            <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                type="button"
                onClick={handleClear}
                className="
                    px-2 py-1 text-[10px] font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0
                    bg-rose-50 border border-rose-100 text-rose-500
                    hover:bg-rose-100 hover:border-rose-200 hover:shadow-sm ml-auto
                "
            >
                <X size={12} />
                <span className="hidden sm:inline">حذف</span>
            </motion.button>
            )}
        </AnimatePresence>
      </motion.div>

      {/* بخش اینپوت‌ها (چیدمان عمودی با اتصال چپ) */}
      <div className="flex flex-col w-full relative">
        {/* خط اتصال عمودی سمت چپ */}
        <div className="absolute left-[22px] top-10 bottom-10 w-0.5 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200 -z-0 rounded-full" />

        <div className="flex flex-col gap-2 w-full z-10">
            {/* ورودی تاریخ شروع */}
            <div className="w-full">
                <SinglePersianDatePicker
                    label="از تاریخ"
                    value={range.start}
                    onChange={handleStartChange}
                    placeholder={placeholder?.start || "شروع بازه..."}
                    maxDate={range.end}
                    isRequired={isRequired}
                    isInvalid={isInvalid}
                />
            </div>

            {/* نشانگر میانی با چیدمان چپ */}
            <div className="flex items-center justify-end gap-2 pl-[14px]">
                <span className="text-[10px] text-slate-400 font-medium">تا</span>
                <div className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 z-10">
                    <ArrowDown size={10} />
                </div>
            </div>

            {/* ورودی تاریخ پایان */}
            <div className="w-full">
                <SinglePersianDatePicker
                    label="تا تاریخ"
                    value={range.end}
                    onChange={handleEndChange}
                    minDate={range.start}
                    isDisabled={!range.start}
                    placeholder={placeholder?.end || "پایان بازه..."}
                    isRequired={isRequired}
                    isInvalid={isInvalid}
                />
            </div>
        </div>
      </div>

      {/* پیام خطا با انیمیشن */}
      <AnimatePresence>
        {isInvalid && errorMessage && (
            <motion.div
                initial={{ opacity: 0, height: 0, y: -5 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -5 }}
                className="text-[10px] font-medium text-rose-500 bg-rose-50 p-2 rounded-lg flex items-center gap-2 border border-rose-100/50 overflow-hidden"
            >
                <span className="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                    <X size={10} className="text-rose-600" />
                </span>
                {errorMessage}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PersianRangeDatePicker;