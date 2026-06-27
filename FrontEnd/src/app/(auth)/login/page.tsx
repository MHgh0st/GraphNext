'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from "@heroui/input";
import { InputOtp } from "@heroui/input-otp";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Phone, ArrowRight, Monitor, Server, Database } from "lucide-react";
import { useRouter } from 'next/navigation';
import LogoType from '../../../assets/images/type.svg';
import LogoSign from '../../../assets/images/sign.svg';


export default function LoginPage() {
    const [step, setStep] = useState<1 | 2>(1);
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const [health, setHealth] = useState<{
        frontend: 'loading' | 'healthy' | 'unhealthy';
        backend: 'loading' | 'healthy' | 'unhealthy';
        database: 'loading' | 'healthy' | 'unhealthy';
    }>({
        frontend: 'healthy',
        backend: 'loading',
        database: 'loading',
    });

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                
                const res = await fetch(`${apiUrl}/health`, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    const data = await res.json();
                    setHealth({
                        frontend: 'healthy',
                        backend: data.backend === 'healthy' ? 'healthy' : 'unhealthy',
                        database: data.database === 'healthy' ? 'healthy' : 'unhealthy',
                    });
                } else {
                    setHealth({
                        frontend: 'healthy',
                        backend: 'unhealthy',
                        database: 'unhealthy',
                    });
                }
            } catch (err) {
                console.error("Health check failed:", err);
                setHealth({
                    frontend: 'healthy',
                    backend: 'unhealthy',
                    database: 'unhealthy',
                });
            }
        };

        checkHealth();
    }, []);

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
                    <div className="flex items-center gap-3 justify-center mb-4 select-none">
                        <LogoSign className="h-14 w-auto text-primary" />
                        <LogoType className="h-14 w-auto text-primary" />
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

                {/* بخش وضعیت سلامت سیستم */}
                <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between px-3 text-[11px] font-medium text-slate-400">
                    <span className="font-vazir select-none">وضعیت سیستم:</span>
                    <div className="flex items-center gap-x-4">
                        {/* فرانت اند */}
                        <div className="flex items-center gap-1.5" title="وضعیت فرانت‌اند">
                            <Monitor size={12} className="text-slate-400" />
                            <span className="font-vazir text-slate-500">فرانت</span>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        </div>
                        
                        {/* بک اند */}
                        <div className="flex items-center gap-1.5" title="وضعیت بک‌اند">
                            <Server size={12} className="text-slate-400" />
                            <span className="font-vazir text-slate-500">بک‌اند</span>
                            <span className="relative flex h-2 w-2">
                                {health.backend === 'loading' && (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </>
                                )}
                                {health.backend === 'healthy' && (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </>
                                )}
                                {health.backend === 'unhealthy' && (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-400"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </>
                                )}
                            </span>
                        </div>

                        {/* دیتابیس */}
                        <div className="flex items-center gap-1.5" title="وضعیت دیتابیس">
                            <Database size={12} className="text-slate-400" />
                            <span className="font-vazir text-slate-500">دیتابیس</span>
                            <span className="relative flex h-2 w-2">
                                {health.database === 'loading' && (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </>
                                )}
                                {health.database === 'healthy' && (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </>
                                )}
                                {health.database === 'unhealthy' && (
                                    <>
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-400"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}