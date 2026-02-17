export default function HACCP() {
  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-extrabold tracking-tight">HACCP</h1>
      <p className="text-sm text-muted-foreground mt-1">
        HACCP plans, hazards, controls and monitoring.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="font-bold">Coming next</div>
        <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Plans per site + product/process</li>
          <li>CCPs, limits, monitoring records</li>
          <li>Corrective actions + verification</li>
        </ul>
      </div>
    </div>
  );
}
