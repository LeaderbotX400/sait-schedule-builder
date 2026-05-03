import HeaderInput from "./features/auth/HeaderInput";

/** Centered sign-in card shown when no credentials are present. */
export default function SignInScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-6 shadow-lg">
        <HeaderInput isConnected={false} />
      </div>
    </div>
  );
}
