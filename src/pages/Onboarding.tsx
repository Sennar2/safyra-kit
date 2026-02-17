import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCompanyAndFirstSite } from "@/lib/profile";
import { useProfile } from "@/lib/profileContext";

export default function Onboarding() {
  const [companyName, setCompanyName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { refresh } = useProfile();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createCompanyAndFirstSite({
        companyName: companyName.trim(),
        siteName: siteName.trim(),
        address: address.trim() || undefined,
      });

      await refresh();
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Something went wrong creating your workspace.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Welcome to Safyra</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Let’s set up your restaurant in under a minute.
      </p>

      <form onSubmit={submit} style={{ marginTop: 18, display: "grid", gap: 12 }}>
        <label>
          Company / Group name
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            placeholder="e.g. Safyra Hospitality Ltd"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          First site name
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            required
            placeholder="e.g. Safyra Kitchen – Kings Road"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Address (optional)
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, City, Postcode"
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        <button type="submit" disabled={loading} style={{ padding: 12, fontWeight: 700 }}>
          {loading ? "Creating..." : "Create workspace"}
        </button>

        <p style={{ fontSize: 12, opacity: 0.65 }}>
          You’ll be able to add more sites and staff after setup.
        </p>
      </form>
    </div>
  );
}
