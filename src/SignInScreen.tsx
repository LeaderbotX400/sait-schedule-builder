import HeaderInput from "./features/auth/HeaderInput";
import Card from "./ui/Card";

/** Centered sign-in card shown when no credentials are present. */
export default function SignInScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-100 p-4">
      <Card size="sm">
        <HeaderInput isConnected={false} />
      </Card>
    </div>
  );
}
