import type { Prefecture } from "../types/prefecture";

/**
 * Calculate the distance between two geographic points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find the nearest prefecture to given coordinates
 * @param lat Target latitude
 * @param lon Target longitude
 * @param prefectures Array of all prefectures
 * @returns The nearest prefecture
 */
export function findNearestPrefecture(
  lat: number,
  lon: number,
  prefectures: Prefecture[],
): Prefecture {
  if (prefectures.length === 0) {
    throw new Error("No prefectures provided");
  }

  let nearestPrefecture = prefectures[0];
  let minDistance = calculateDistance(
    lat,
    lon,
    nearestPrefecture.latitude,
    nearestPrefecture.longitude,
  );

  for (let i = 1; i < prefectures.length; i++) {
    const prefecture = prefectures[i];
    const distance = calculateDistance(
      lat,
      lon,
      prefecture.latitude,
      prefecture.longitude,
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestPrefecture = prefecture;
    }
  }

  return nearestPrefecture;
}
