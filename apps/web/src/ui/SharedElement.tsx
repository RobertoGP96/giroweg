"use client";

import { ViewTransition, type ReactNode } from "react";

interface SharedElementProps {
  /** Unique across the whole page, e.g. `vehicle-icon-<id>`. */
  name: string;
  children: ReactNode;
}

/**
 * An element that exists on two screens (a vehicle's icon in its list card
 * and in its detail header) glides from one place to the other during the
 * route transition. Without a counterpart it simply travels with its page.
 */
export function SharedElement({ name, children }: SharedElementProps) {
  return (
    <ViewTransition name={name} default="none" share="gw-shared">
      {children}
    </ViewTransition>
  );
}
