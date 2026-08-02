import { useCallback, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { extractQrToken } from "@/lib/qr-token";

type TableQrScannerProps = {
  expectedToken: string;
  onSuccess: (token: string) => void;
  onInvalid: () => void;
  onClose: () => void;
};

export function TableQrScanner({
  expectedToken,
  onSuccess,
  onInvalid,
  onClose,
}: TableQrScannerProps) {
  const [paused, setPaused] = useState(false);

  const handleScan = useCallback(
    (detectedCodes: { rawValue: string }[]) => {
      if (paused || detectedCodes.length === 0) return;

      const scanned = extractQrToken(detectedCodes[0].rawValue);
      if (!scanned || scanned !== expectedToken) {
        setPaused(true);
        onInvalid();
        window.setTimeout(() => setPaused(false), 2000);
        return;
      }

      setPaused(true);
      onSuccess(scanned);
    },
    [expectedToken, onInvalid, onSuccess, paused],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-display text-lg font-semibold">Scan table QR</p>
          <p className="text-xs text-muted-foreground">Point your camera at the stand on your table</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onClose}
          aria-label="Close scanner"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative mx-auto mt-6 w-full max-w-md flex-1 px-5 pb-8">
        <div className="overflow-hidden rounded-2xl border border-border bg-black">
          <Scanner
            onScan={handleScan}
            onError={() => onInvalid()}
            paused={paused}
            scanDelay={1500}
            constraints={{ facingMode: "environment" }}
            styles={{
              container: { width: "100%", aspectRatio: "1", minHeight: "280px" },
            }}
          />
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Align the QR code on your table stand within the frame
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-12 w-full active:scale-95"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
