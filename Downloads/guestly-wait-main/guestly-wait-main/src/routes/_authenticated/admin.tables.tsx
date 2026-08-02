import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/tables")({
  component: TablesAdmin,
});

function TablesAdmin() {
  const [showFrontDoorModal, setShowFrontDoorModal] = useState(false);

  const { data: tables = [] } = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .order("table_number");
      if (error) throw error;
      return data;
    },
  });

  function download(tableNumber: number) {
    const canvas = document.getElementById(`qr-${tableNumber}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `tablepe-table-${tableNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const frontDoorUrl = `${origin}/join-waitlist`;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tables &amp; QR codes</h1>
          <p className="text-sm text-muted-foreground">Manage table QR codes and print front door waitlist QR.</p>
        </div>
        <Button
          onClick={() => setShowFrontDoorModal(true)}
          className="flex items-center gap-2 font-semibold shadow-sm"
        >
          <QrCode className="h-4 w-4" />
          View Front Door QR
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tables.map((t) => (
          <div key={t.id} className="surface-card rounded-2xl p-4 text-center">
            <p className="font-display text-xl font-semibold">Table {t.table_number}</p>
            <p className="text-xs text-muted-foreground">Seats {t.capacity} · {t.status}</p>
            <div className="mt-3 flex justify-center rounded-xl bg-card p-3">
              <QRCodeCanvas
                id={`qr-${t.table_number}`}
                value={`${origin}/checkin?t=${t.qr_token}`}
                size={140}
                includeMargin
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full active:scale-95"
              onClick={() => download(t.table_number)}
            >
              Download QR
            </Button>
          </div>
        ))}
      </div>

      {/* Front Door Waitlist QR Modal */}
      <Dialog open={showFrontDoorModal} onOpenChange={setShowFrontDoorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle>Front Door Waitlist QR</DialogTitle>
            <DialogDescription>
              Display or print this QR code at your entrance for guests to join the waitlist.
            </DialogDescription>
          </DialogHeader>

          {/* Printable Container */}
          <div id="front-door-qr-print" className="my-4 flex flex-col items-center justify-center text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Scan to Join Waitlist
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Skip the line — check in from your phone
            </p>
            <div className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-md">
              <QRCodeCanvas
                value={frontDoorUrl}
                size={220}
                includeMargin
              />
            </div>
            <p className="mt-4 font-mono text-xs font-medium text-muted-foreground">
              {frontDoorUrl}
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <Button onClick={handlePrint} className="flex items-center gap-2 font-semibold active:scale-95">
              <Printer className="h-4 w-4" />
              Print QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
