"use client";
import {HeroUIProvider} from "@heroui/system";
import {ToastProvider} from "@heroui/toast";
import {useRouter} from "next/navigation";

export default function Providers({
  children,
}: Readonly<{
  children: React.ReactNode;
}>){
    const router = useRouter();
    return <>
        <HeroUIProvider navigate={router.push}>
          <ToastProvider />
          {children}
        </HeroUIProvider>
    </>
}