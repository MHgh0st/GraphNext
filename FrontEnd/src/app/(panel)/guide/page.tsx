'use client';

import { motion } from "framer-motion";
import { BookOpen, Compass, Settings, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";

export default function GuidePage() {
  const sections = [
    {
      title: "آشنایی با مفاهیم فرآیندکاوی",
      desc: "یادگیری مبانی فرآیندکاوی، مفاهیم رویداد (Event)، پرونده (Case)، و نحوه کشف مدل فرآیند.",
      icon: Compass,
      color: "from-blue-500/10 to-indigo-500/10 text-blue-600 border-blue-200/50"
    },
    {
      title: "تحلیل نمودار جریان (DFG)",
      desc: "چگونه جریان‌ها و فرکانس یال‌ها و گره‌ها را تفسیر کنیم و گلوگاه‌های زمانی را بیابیم.",
      icon: BookOpen,
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 border-emerald-200/50"
    },
    {
      title: "تنظیمات پیشرفته و پالت‌ها",
      desc: "سفارشی‌سازی ابعاد نمایش، فیلترینگ کلاینت‌ساید نودها و تغییر طیف‌های رنگی نمودار.",
      icon: Settings,
      color: "from-purple-500/10 to-pink-500/10 text-purple-600 border-purple-200/50"
    }
  ];

  return (
    <div className="flex flex-col gap-y-6 h-full p-4 text-right" dir="rtl">
      {/* هدر بخش */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl shadow-inner">
          <BookOpen size={24} />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-800">راهنما و مستندات سیستم</h2>
          <p className="text-xs text-slate-400 mt-1">آموزش کار با بخش‌های مختلف فرآیندنگار</p>
        </div>
      </div>

      {/* بخش کارت Coming Soon با افکت زیبای شیشه‌ای و انیمیشن */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border border-teal-100/70 bg-gradient-to-br from-teal-50/20 via-white/80 to-emerald-50/20 backdrop-blur-md overflow-hidden shadow-sm rounded-3xl relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-200/20 rounded-full blur-2xl -z-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl -z-10" />
          
          <CardBody className="p-8 flex flex-col items-center justify-center text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 mb-5"
            >
              <Sparkles size={32} />
            </motion.div>

            <Chip 
              color="secondary" 
              variant="flat"
              className="mb-3 font-semibold text-xs bg-teal-100/50 text-teal-700 border-teal-200"
            >
              در دست توسعه و طراحی
            </Chip>

            <h3 className="text-base font-bold text-slate-800 mb-2">
              این بخش به زودی فعال خواهد شد!
            </h3>
            
            <p className="text-xs text-slate-500 leading-6 max-w-sm">
              در حال آماده‌سازی راهنمای جامع و هوشمند برای کمک به شما در تحلیل پرونده‌ها، عیب‌یابی جریان‌ها و کارکرد ابزارهای پیشرفته فرآیندنگار هستیم. از شکیبایی شما سپاسگزاریم.
            </p>
          </CardBody>
        </Card>
      </motion.div>

      {/* عناوین راهنما که به زودی اضافه می شوند */}
      <div className="space-y-3 mt-2">
        <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5 px-1">
          <AlertCircle size={14} />
          عناوین در حال تدوین:
        </h4>

        <div className="grid grid-cols-1 gap-3">
          {sections.map((sec, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="flex items-start gap-3 p-4 rounded-2xl border border-slate-100/80 bg-white/60 hover:bg-white/95 transition-all duration-200 shadow-sm"
            >
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${sec.color} flex items-center justify-center shrink-0`}>
                <sec.icon size={18} />
              </div>
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-slate-800">{sec.title}</h5>
                <p className="text-[10.5px] text-slate-400 leading-5">{sec.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
