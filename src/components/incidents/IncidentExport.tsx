import { Button } from "@/components/ui/button";

export default function IncidentExport() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Export Incidents</h2>

      <Button>
        Export CSV (Coming next)
      </Button>

      <Button variant="outline">
        Download All PDFs (Coming next)
      </Button>
    </div>
  );
}