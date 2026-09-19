import { Suspense } from "react";
import { OtpScreen } from "@/features/auth/screens/OtpScreen";

export default function VerifyPage() {
  return (
    <Suspense>
      <OtpScreen />
    </Suspense>
  );
}
