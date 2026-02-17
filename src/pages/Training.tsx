export default function Training() {
  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Training</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Assign training modules, track completion, and store evidence.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="font-bold">Coming next</div>
        <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Modules + quizzes + certificates</li>
          <li>Expiry dates + reminders</li>
          <li>Induction pathways by role</li>
        </ul>
      </div>
    </div>
  );
}
