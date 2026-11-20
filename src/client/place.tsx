import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { z } from "zod";
import { type Place, PlaceSchema } from "../domain/TouringIndex";

export type Consent = "unset" | "granted" | "declined";

export const DEFAULT_PLACE: Place = {
  name: "東京",
  latitude: 35.6812,
  longitude: 139.7671,
};

const CHOSEN_KEY = "mwi.place";
const LOCATION_KEY = "mwi.location";
const CONSENT_KEY = "mwi.consent";
/** The privacy policy promises that a stored position leaves the device after a day. */
const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;
const CURRENT_LOCATION_NAME = "現在地";

const StoredLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  savedAt: z.number(),
});
type StoredLocation = z.infer<typeof StoredLocationSchema>;

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

function read<S extends z.ZodType>(key: string, schema: S) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return undefined;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as z.infer<S>) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A browser that refuses storage still gets a working session.
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // See write.
  }
}

function readLocation(): StoredLocation | undefined {
  const stored = read(LOCATION_KEY, StoredLocationSchema);
  if (stored === undefined) return undefined;
  if (Date.now() - stored.savedAt >= LOCATION_TTL_MS) {
    remove(LOCATION_KEY);
    return undefined;
  }
  return stored;
}

function readConsent(): Consent {
  return read(CONSENT_KEY, z.enum(["granted", "declined"])) ?? "unset";
}

function failureMessage(error: { code: number } | undefined): string {
  if (error === undefined) return "このブラウザは位置情報に対応していません。";
  if (error.code === 1) {
    return "位置情報の利用が許可されませんでした。ブラウザの設定を確認してください。";
  }
  return "現在地を取得できませんでした。";
}

const PlaceContext = createContext<PlaceState | undefined>(undefined);

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Place | undefined>(() =>
    read(CHOSEN_KEY, PlaceSchema),
  );
  const [location, setLocation] = useState(readLocation);
  const [consent, setConsent] = useState(readConsent);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const choosePlace = useCallback((place: Place) => {
    write(CHOSEN_KEY, place);
    setChosen(place);
    remove(LOCATION_KEY);
    setLocation(undefined);
  }, []);

  const enableCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const geolocation = navigator.geolocation as Geolocation | undefined;
      if (!geolocation) throw undefined;
      const { coords } = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 }),
      );
      const stored = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        savedAt: Date.now(),
      };
      write(LOCATION_KEY, stored);
      write(CONSENT_KEY, "granted");
      setLocation(stored);
      setConsent("granted");
    } catch (error) {
      setLocationError(
        failureMessage(
          typeof error === "object" && error !== null && "code" in error
            ? (error as { code: number })
            : undefined,
        ),
      );
    } finally {
      setIsLocating(false);
    }
  }, []);

  const declineCurrentLocation = useCallback(() => {
    write(CONSENT_KEY, "declined");
    setConsent("declined");
  }, []);

  const deleteStoredLocation = useCallback(() => {
    remove(LOCATION_KEY);
    setLocation(undefined);
  }, []);

  const withdrawConsent = useCallback(() => {
    remove(LOCATION_KEY);
    remove(CONSENT_KEY);
    setLocation(undefined);
    setConsent("unset");
  }, []);

  const place = useMemo<Place>(
    () =>
      location === undefined
        ? (chosen ?? DEFAULT_PLACE)
        : {
            name: CURRENT_LOCATION_NAME,
            latitude: location.latitude,
            longitude: location.longitude,
          },
    [location, chosen],
  );

  const value = useMemo<PlaceState>(
    () => ({
      place,
      consent,
      isLocating,
      locationError,
      choosePlace,
      enableCurrentLocation,
      declineCurrentLocation,
      deleteStoredLocation,
      withdrawConsent,
    }),
    [
      place,
      consent,
      isLocating,
      locationError,
      choosePlace,
      enableCurrentLocation,
      declineCurrentLocation,
      deleteStoredLocation,
      withdrawConsent,
    ],
  );

  return (
    <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>
  );
}

export function usePlace(): PlaceState {
  const value = useContext(PlaceContext);
  if (value === undefined) {
    throw new Error("usePlace needs a PlaceProvider above it");
  }
  return value;
}
