import { TURKISH_DISTRICTS } from "./turkishDistricts";

export const WEATHER_ORIGINS = [
  "https://geocoding-api.open-meteo.com/*",
  "https://api.open-meteo.com/*",
] as const;

export interface WeatherLocationSuggestion {
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  local?: boolean;
}

const TURKISH_PROVINCES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkâri", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
] as const;

export interface WeatherDay {
  date: string;
  code: number;
  minimum: number;
  maximum: number;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherHour {
  time: string;
  apparentTemperature: number;
  precipitationProbability: number;
  windSpeed: number;
}

export interface WeatherSnapshot {
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  fetchedAt: string;
  current: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    precipitation: number;
    windSpeed: number;
    code: number;
  };
  days: WeatherDay[];
  hours: WeatherHour[];
}

export function weatherDescription(code: number, locale: "tr" | "en"): string {
  const tr: Readonly<Record<number, string>> = {
    0: "Açık", 1: "Çoğunlukla açık", 2: "Parçalı bulutlu", 3: "Kapalı",
    45: "Sisli", 48: "Kırağılı sis", 51: "Hafif çisenti", 53: "Çisenti",
    55: "Yoğun çisenti", 61: "Hafif yağmur", 63: "Yağmur", 65: "Kuvvetli yağmur",
    71: "Hafif kar", 73: "Kar", 75: "Yoğun kar", 80: "Sağanak", 81: "Sağanak",
    82: "Kuvvetli sağanak", 95: "Gök gürültülü", 96: "Dolu ihtimali", 99: "Dolu ihtimali",
  };
  const en: Readonly<Record<number, string>> = {
    0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog",
    48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
    75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers",
    95: "Thunderstorm", 96: "Hail possible", 99: "Hail possible",
  };
  return (locale === "tr" ? tr : en)[code] ?? (locale === "tr" ? "Değişken" : "Variable");
}

export function weatherSymbol(code: number): string {
  if (code === 0) return "☀";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁";
  if (code === 45 || code === 48) return "≋";
  if (code >= 71 && code <= 77) return "❄";
  if (code >= 95) return "ϟ";
  return "☂";
}

export function suitableOutdoorHours(snapshot: WeatherSnapshot, now = new Date()): string[] {
  const candidates = snapshot.hours.filter((hour) => {
    const instant = new Date(hour.time);
    const delta = instant.getTime() - now.getTime();
    return delta >= -60 * 60_000 && delta <= 24 * 60 * 60_000 &&
      hour.precipitationProbability < 30 && hour.windSpeed < 25 &&
      hour.apparentTemperature >= 10 && hour.apparentTemperature <= 30;
  });
  const groups: WeatherHour[][] = [];
  for (const hour of candidates) {
    const previous = groups.at(-1)?.at(-1);
    if (!previous || new Date(hour.time).getTime() - new Date(previous.time).getTime() > 70 * 60_000) groups.push([hour]);
    else groups.at(-1)!.push(hour);
  }
  return groups.slice(0, 3).map((group) => {
    const start = new Date(group[0].time);
    const end = new Date(group.at(-1)!.time);
    end.setHours(end.getHours() + 1);
    return `${String(start.getHours()).padStart(2, "0")}:00–${String(end.getHours()).padStart(2, "0")}:00`;
  });
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

export function localLocationSuggestions(query: string): WeatherLocationSuggestion[] {
  const needle = normalizeSearch(query.trim());
  if (needle.length < 1) return [];
  const provinces = TURKISH_PROVINCES
    .filter((name) => normalizeSearch(name).startsWith(needle))
    .map((label) => ({ id: `local:${label}`, label, local: true }));
  const districts = TURKISH_DISTRICTS.flatMap(({ district, province }) => {
    const label = `${district}, ${province}`;
    const provinceFirst = `${province} ${district}`;
    if (!normalizeSearch(label).startsWith(needle) && !normalizeSearch(provinceFirst).startsWith(needle)) return [];
    return [{ id: `local:${province}:${district}`, label, local: true }];
  });
  return [...provinces, ...districts].slice(0, 8);
}

export async function hasWeatherAccess(): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.permissions) return true;
  return chrome.permissions.contains({ origins: [...WEATHER_ORIGINS] });
}

export async function requestWeatherAccess(includeGeolocation = false): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.permissions) return true;
  return chrome.permissions.request({
    origins: [...WEATHER_ORIGINS],
    ...(includeGeolocation ? { permissions: ["geolocation"] } : {}),
  });
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url, { credentials: "omit", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
  return await response.json() as Record<string, unknown>;
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("Invalid weather data.");
  return value.map((item) => typeof item === "number" && Number.isFinite(item) ? item : 0);
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Invalid weather data.");
  return value.map((item) => typeof item === "string" ? item : "");
}

export async function searchWeatherLocations(query: string, locale: "tr" | "en"): Promise<WeatherLocationSuggestion[]> {
  const clean = query.trim();
  const local = localLocationSuggestions(clean);
  if (clean.length < 2 || !(await hasWeatherAccess())) return local;
  const params = new URLSearchParams({ name: clean, count: "8", language: locale, format: "json" });
  const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`) as {
    results?: Array<{ id?: unknown; name?: unknown; admin1?: unknown; country?: unknown; latitude?: unknown; longitude?: unknown; timezone?: unknown }>;
  };
  const remote = (data.results ?? []).flatMap((place) => {
    if (typeof place.name !== "string" || typeof place.latitude !== "number" || typeof place.longitude !== "number") return [];
    const label = [place.name, typeof place.admin1 === "string" ? place.admin1 : undefined, typeof place.country === "string" ? place.country : undefined]
      .filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(", ");
    return [{ id: `remote:${String(place.id ?? `${place.latitude}:${place.longitude}`)}`, label, latitude: place.latitude, longitude: place.longitude, timezone: typeof place.timezone === "string" ? place.timezone : undefined }];
  });
  const distinctRemote = remote.filter((remotePlace) => !local.some((localPlace) =>
    normalizeSearch(remotePlace.label).startsWith(`${normalizeSearch(localPlace.label)},`),
  ));
  return [...local, ...distinctRemote].slice(0, 8);
}

async function geocodeFirst(query: string, locale: "tr" | "en", countryCode?: string): Promise<WeatherLocationSuggestion> {
  const params = new URLSearchParams({ name: query, count: "1", language: locale, format: "json" });
  if (countryCode) params.set("countryCode", countryCode);
  const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`) as {
    results?: Array<{ id?: unknown; name?: unknown; admin1?: unknown; country?: unknown; latitude?: unknown; longitude?: unknown; timezone?: unknown }>;
  };
  const place = data.results?.[0];
  if (!place || typeof place.name !== "string" || typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    throw new Error("Location was not found.");
  }
  return {
    id: `remote:${String(place.id ?? `${place.latitude}:${place.longitude}`)}`,
    label: [place.name, typeof place.admin1 === "string" ? place.admin1 : undefined, typeof place.country === "string" ? place.country : undefined]
      .filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(", "),
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: typeof place.timezone === "string" ? place.timezone : undefined,
  };
}

export async function fetchWeatherForLocation(location: WeatherLocationSuggestion, locale: "tr" | "en"): Promise<WeatherSnapshot> {
  const resolved = typeof location.latitude === "number" && typeof location.longitude === "number"
    ? location
    : await geocodeFirst(location.label, locale, location.local ? "TR" : undefined);
  const params = new URLSearchParams({
    latitude: String(resolved.latitude), longitude: String(resolved.longitude), timezone: "auto", forecast_days: "5",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    hourly: "apparent_temperature,precipitation_probability,wind_speed_10m",
  });
  const forecast = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const current = forecast.current as Record<string, unknown> | undefined;
  const daily = forecast.daily as Record<string, unknown> | undefined;
  const hourly = forecast.hourly as Record<string, unknown> | undefined;
  if (!current || !daily || !hourly) throw new Error("Weather service returned incomplete data.");
  const dayTimes = textArray(daily.time);
  const dayCodes = numberArray(daily.weather_code);
  const dayMin = numberArray(daily.temperature_2m_min);
  const dayMax = numberArray(daily.temperature_2m_max);
  const dayRain = numberArray(daily.precipitation_probability_max);
  const sunrises = textArray(daily.sunrise);
  const sunsets = textArray(daily.sunset);
  const hourTimes = textArray(hourly.time);
  const hourTemperatures = numberArray(hourly.apparent_temperature);
  const hourRain = numberArray(hourly.precipitation_probability);
  const hourWind = numberArray(hourly.wind_speed_10m);
  const numeric = (key: string) => typeof current[key] === "number" && Number.isFinite(current[key]) ? current[key] as number : 0;
  return {
    location: resolved.label,
    latitude: resolved.latitude!, longitude: resolved.longitude!,
    timezone: typeof forecast.timezone === "string" ? forecast.timezone : resolved.timezone ?? "auto",
    fetchedAt: new Date().toISOString(),
    current: { temperature: numeric("temperature_2m"), apparentTemperature: numeric("apparent_temperature"), humidity: numeric("relative_humidity_2m"), precipitation: numeric("precipitation"), windSpeed: numeric("wind_speed_10m"), code: numeric("weather_code") },
    days: dayTimes.slice(0, 5).map((date, index) => ({ date, code: dayCodes[index], minimum: dayMin[index], maximum: dayMax[index], precipitationProbability: dayRain[index], sunrise: sunrises[index], sunset: sunsets[index] })),
    hours: hourTimes.slice(0, 120).map((time, index) => ({ time, apparentTemperature: hourTemperatures[index], precipitationProbability: hourRain[index], windSpeed: hourWind[index] })),
  };
}

export async function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: false,
    timeout: 12_000,
    maximumAge: 10 * 60_000,
  }));
}
