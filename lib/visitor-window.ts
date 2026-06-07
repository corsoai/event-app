import type { Visitor } from "@/lib/types";

export const VISITOR_CODE_VALIDITY_HOURS = 6;
export const VISITOR_CHECK_IN_WINDOW_HOURS = VISITOR_CODE_VALIDITY_HOURS;

type VisitorSchedule = Pick<Visitor, "visitDate" | "arrivalTime"> & {
  createdAt?: string;
  expiresAt?: string;
};

export type VisitorWindowState = {
  status: "early" | "open" | "expired" | "invalid";
  opensAt: Date;
  closesAt: Date;
  canVerifyOrCheckIn: boolean;
  message: string;
};

export function getVisitorCheckInWindow(visitor: VisitorSchedule) {
  const opensAt = visitorGeneratedDate(visitor);
  const defaultClosesAt = new Date(opensAt.getTime() + VISITOR_CODE_VALIDITY_HOURS * 60 * 60 * 1000);
  const savedClosesAt = visitor.expiresAt ? new Date(visitor.expiresAt) : null;
  const closesAt = savedClosesAt && !Number.isNaN(savedClosesAt.getTime()) && savedClosesAt < defaultClosesAt
    ? savedClosesAt
    : defaultClosesAt;

  return { opensAt, closesAt };
}

export function getVisitorExpiresAtIso(visitor: VisitorSchedule) {
  return getVisitorCheckInWindow(visitor).closesAt.toISOString();
}

export function getVisitorWindowState(visitor: VisitorSchedule, now = new Date()): VisitorWindowState {
  const { opensAt, closesAt } = getVisitorCheckInWindow(visitor);

  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
    return {
      status: "invalid",
      opensAt,
      closesAt,
      canVerifyOrCheckIn: false,
      message: "This visitor invitation has an invalid validity time."
    };
  }

  if (now < opensAt) {
    return {
      status: "early",
      opensAt,
      closesAt,
      canVerifyOrCheckIn: false,
      message: `Check-in opens when the code is generated at ${formatGateTime(opensAt)}.`
    };
  }

  if (now > closesAt) {
    return {
      status: "expired",
      opensAt,
      closesAt,
      canVerifyOrCheckIn: false,
      message: `This visitor code expired at ${formatGateTime(closesAt)}.`
    };
  }

  return {
    status: "open",
    opensAt,
    closesAt,
    canVerifyOrCheckIn: true,
    message: `Code is valid until ${formatGateTime(closesAt)}.`
  };
}

export function visitorCanStillCheckOut(visitor: Visitor) {
  return visitor.status === "checked-in";
}

export function isVisitorFinalOrBlocked(visitor: Visitor) {
  return visitor.status === "cancelled" || visitor.status === "expired" || visitor.status === "checked-out";
}

export function formatGateTime(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "Africa/Lagos"
  }).format(date);
}

function visitorGeneratedDate(visitor: VisitorSchedule) {
  if (visitor.createdAt) {
    const createdAt = new Date(visitor.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      return createdAt;
    }
  }

  return new Date();
}
