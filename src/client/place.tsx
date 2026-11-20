import type { ReactNode } from "react";
import type { Place } from "../domain/TouringIndex";

export type Consent = "unset" | "granted" | "declined";

export const DEFAULT_PLACE: Place = {
  name: "東京",
  latitude: 35.6812,
  longitude: 139.7671,
};

export interface PlaceState {
  place: Place;
  consent: Consent;
  isLocating: boolean;
  locationError: string | null;
  choosePlace: (place: Place) => void;
  enableCurrentLocation: () => Promise<void>;
  declineCurrentLocation: () => void;
  deleteStoredLocation: () => void;
  withdrawConsent: () => void;
}

export function PlaceProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function usePlace(): PlaceState {
  return {
    place: DEFAULT_PLACE,
    consent: "unset",
    isLocating: false,
    locationError: null,
    choosePlace: () => {},
    enableCurrentLocation: async () => {},
    declineCurrentLocation: () => {},
    deleteStoredLocation: () => {},
    withdrawConsent: () => {},
  };
}
