"use client";
import {HeroUIProvider} from "@heroui/system";
import {useRouter} from "next/navigation";

export default function Providers({
  children,
}: Readonly<{
  children: React.ReactNode;
}>){
    const router = useRouter();
    return <>
        <HeroUIProvider navigate={router.push}>
            {children}
        </HeroUIProvider>
    </>
}