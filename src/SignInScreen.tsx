import { useAuth } from "./auth";
import Card from "./ui/Card";

export default function SignInScreen() {
  const { busy, error, login } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-100 p-4">
      <Card size="sm">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Connect to SAIT Banner</h3>
        <p className="text-xs text-gray-500 mb-4">
          A SAIT login window will open. Sign in and it will close automatically.
        </p>
        <button
          type="button"
          onClick={() => void login()}
          disabled={busy}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Waiting for SAIT login…" : "Sign in with SAIT"}
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </Card>
    </div>
  );
}
