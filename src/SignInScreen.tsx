import { useAuth } from "./auth";
import ExtensionIdSettings from "./features/auth/ExtensionIdSettings";
import ThemePicker from "./features/theme/ThemePicker";
import Card from "./ui/Card";

export default function SignInScreen() {
  const { busy, error, login } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-page text-fg p-4">
      <Card size="sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-sm font-medium text-fg-muted">Connect to SAIT Banner</h1>
          <ThemePicker />
        </div>
        <p className="text-xs text-fg-faint mb-4">
          A SAIT login window will open. Sign in and it will close automatically.
        </p>
        <button
          type="button"
          onClick={() => void login()}
          disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Waiting for SAIT login…" : "Sign in with SAIT"}
        </button>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        <ExtensionIdSettings />
      </Card>
    </div>
  );
}
