import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
    // اینجا فرض کردیم توکن شما تحت عنوان auth_token در کوکی‌ها ذخیره شده
    const token = request.cookies.get('auth_token')?.value;
    const isLoginPage = request.nextUrl.pathname.startsWith('/login');

    // اگر کاربر توکن نداره و تو صفحه لاگین هم نیست، بفرستش به صفحه لاگین
    if (!token && !isLoginPage) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // اگر کاربر لاگین کرده ولی میخواد دوباره بره صفحه لاگین، بفرستش به داشبورد (صفحه اصلی)
    if (token && isLoginPage) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

// اینجا مشخص می‌کنیم که این میدلور روی چه مسیرهایی اعمال بشه
export const config = {
    matcher: [
        /*
         * روی تمام مسیرها اعمال بشه به جز:
         * - مسیرهای api (بک‌اند خود Next)
         * - فایل‌های استاتیک مثل تصاویر و فونت‌ها
         * - فایل favicon
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};