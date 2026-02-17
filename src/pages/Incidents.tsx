export default function Incidents() {
  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Incidents</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Log incidents, assign actions, and keep auditable records.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="font-bold">Coming next</div>
        <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Incident types (food safety, injury, equipment, pest)</li>
          <li>Action owner + due date + status</li>
          <li>Attachments + export PDF</li>
        </ul>
      </div>
    </div>
  );
}
