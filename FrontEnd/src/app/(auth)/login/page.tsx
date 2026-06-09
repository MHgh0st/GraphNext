'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [step, setStep] = useState<1 | 2>(1);
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // بررسی فرمت صحیح شماره موبایل ایران (۱۱ رقم، شروع با 09)
    const iranianPhoneRegex = /^09\d{9}$/;

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();

        // اعتبارسنجی شماره تماس
        if (!iranianPhoneRegex.test(phone)) {
            setPhoneError('شماره موبایل وارد شده نامعتبر است (مثال: 09123456789)');
            return;
        }

        setPhoneError(''); // پاک کردن ارور در صورت معتبر بودن شماره
        setIsLoading(true);
        try {
            // TODO: اینجا API ارسال پیامک رو کال کن
            await new Promise(resolve => setTimeout(resolve, 1000)); // شبیه‌سازی درخواست
            setStep(2);
        } catch (error) {
            console.error("Error sending OTP", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        // چک کردن اینکه کد ۵ رقمی کامل وارد شده باشه
        if (!otp || otp.length < 5) return;

        setIsLoading(true);
        try {
            // TODO: اینجا API تایید کد و دریافت توکن رو کال کن
            await new Promise(resolve => setTimeout(resolve, 1500)); // شبیه‌سازی درخواست

            // توکن رو توی کوکی یا لوکال استوریج ذخیره کن
            document.cookie = "auth_token=your_mock_token; path=/;";

            // ثبت لاگ در بک‌اند خودمون
            await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/auth/log-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_number: phone })
            });

            router.push('/');
        } catch (error) {
            console.error("Error verifying OTP", error);
        } finally {
            setIsLoading(false);
        }
    };

    // تنظیمات انیمیشن
    const variants = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* بک‌گراند دکوراتیو مشابه دیزاین سیستم پروژه */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/20 rounded-full blur-3xl" />

            <Card className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-xl rounded-3xl p-4 z-10" shadow="none">
                <CardHeader className="flex flex-col gap-y-2 items-center justify-center pt-6 pb-2">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700 mb-2">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">ورود به سامانه</h1>
                    <p className="text-sm text-slate-500 text-center">
                        {step === 1 ? 'برای ورود یا ثبت‌نام، شماره تماس خود را وارد کنید' : 'کد تایید ۵ رقمی ارسال شده را وارد کنید'}
                    </p>
                </CardHeader>

                <CardBody className="overflow-hidden pb-6">
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.form
                                key="step1"
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ duration: 0.3 }}
                                onSubmit={handleSendOtp}
                                className="flex flex-col gap-4"
                            >
                                <Input
                                    autoFocus
                                    type="tel"
                                    dir="ltr"
                                    placeholder="09123456789"
                                    value={phone}
                                    onValueChange={(val) => {
                                        setPhone(val);
                                        if (phoneError) setPhoneError('');
                                    }}
                                    isInvalid={!!phoneError}
                                    errorMessage={phoneError}
                                    maxLength={11}
                                    startContent={<Phone className="text-slate-400" size={18} />}
                                    size="lg"
                                    variant="bordered"
                                    radius="lg"
                                    className="bg-white"
                                />
                                <Button
                                    type="submit"
                                    color="primary"
                                    size="lg"
                                    radius="lg"
                                    isLoading={isLoading}
                                    className="w-full font-bold shadow-md shadow-blue-500/20"
                                >
                                    ارسال کد تایید
                                </Button>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="step2"
                                variants={variants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                transition={{ duration: 0.3 }}
                                onSubmit={handleVerifyOtp}
                                className="flex flex-col gap-4 items-center"
                            >
                                <div className="w-full flex justify-center py-2" dir="ltr">
                                    <InputOtp
                                        autoFocus
                                        length={5}
                                        value={otp}
                                        onValueChange={setOtp}
                                        size="lg"
                                        variant="bordered"
                                        radius="lg"
                                        classNames={{
                                            segmentWrapper: "gap-x-2" // ایجاد فاصله یکدست بین باکس‌ها
                                        }}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    color="primary"
                                    size="lg"
                                    radius="lg"
                                    isLoading={isLoading}
                                    className="w-full font-bold shadow-md shadow-blue-500/20"
                                >
                                    تایید و ورود
                                </Button>
                                <Button
                                    variant="light"
                                    color="default"
                                    size="sm"
                                    onPress={() => {
                                        setStep(1);
                                        setOtp(''); // ریست کردن کد موقع بازگشت
                                    }}
                                    className="mt-2 text-slate-500"
                                    startContent={<ArrowRight size={16} />}
                                >
                                    اصلاح شماره
                                </Button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </CardBody>
            </Card>
        </div>
    );
}