import { useAuth } from "@/lib/auth";

export default function NoAccess() {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>No access yet</h1>
      <p style={{ marginTop: 10, opacity: 0.8 }}>
        Your account <b>{user?.email}</b> is not assigned to any company.
      </p>
      <p style={{ marginTop: 10, opacity: 0.8 }}>
        Please contact the Safyra platform admin to assign your company and role.
      </p>
    </div>
  );
}
