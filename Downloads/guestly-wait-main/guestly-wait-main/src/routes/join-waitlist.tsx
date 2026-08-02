import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/join-waitlist")({
  component: JoinWaitlistRedirect,
});

function JoinWaitlistRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // If guest already has an active waitlist session, go straight to status
    const activeId = typeof window !== "undefined"
      ? localStorage.getItem("active_waitlist_id")
      : null;

    if (activeId) {
      navigate({ to: "/waitlist-status", replace: true });
    } else {
      navigate({ to: "/checkin", search: { t: "" }, replace: true });
    }
  }, [navigate]);

  return null;
}
