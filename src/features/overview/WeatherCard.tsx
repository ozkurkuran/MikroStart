import { useEffect, useMemo, useState } from "preact/hooks";

import { localeTag, useI18n } from "../../platform/i18n";
import type { WeatherSnapshot } from "./weather";
import {
  currentPosition,
  fetchWeatherForLocation,
  localLocationSuggestions,
  requestWeatherAccess,
  searchWeatherLocations,
  suitableOutdoorHours,
  weatherDescription,
  weatherSymbol,
  type WeatherLocationSuggestion,
} from "./weather";

interface WeatherCardProps {
  query: string;
  snapshot?: WeatherSnapshot;
  onQueryChange: (query: string) => void;
  onSnapshot: (snapshot: WeatherSnapshot) => void;
}

function shortTime(value: string, locale: "tr" | "en"): string {
  const localTime = value.split("T")[1]?.slice(0, 5);
  return localTime || new Intl.DateTimeFormat(localeTag(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function WeatherCard({ query, snapshot, onQueryChange, onSnapshot }: WeatherCardProps) {
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<WeatherLocationSuggestion[]>([]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const outdoorHours = useMemo(() => snapshot ? suitableOutdoorHours(snapshot) : [], [snapshot]);

  useEffect(() => {
    const clean = query.trim();
    if (!suggestionsVisible || clean.length < 1) {
      setSuggestions([]);
      return;
    }
    setSuggestions(localLocationSuggestions(clean));
    const timer = window.setTimeout(() => {
      void searchWeatherLocations(clean, locale).then((items) => {
        if (items.length) setSuggestions(items);
      }).catch(() => undefined);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, locale, suggestionsVisible]);

  async function loadLocation(location?: WeatherLocationSuggestion) {
    const clean = location?.label ?? query.trim();
    if (!clean) {
      setMessage(t("overview.weather.locationRequired"));
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      if (!(await requestWeatherAccess(false))) {
        setMessage(t("overview.weather.permissionDenied"));
        return;
      }
      const weather = await fetchWeatherForLocation(location ?? { id: `query:${clean}`, label: clean, local: true }, locale);
      onQueryChange(weather.location);
      onSnapshot(weather);
      setSuggestionsVisible(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("overview.weather.failed"));
    } finally {
      setLoading(false);
    }
  }

  async function useCurrentLocation() {
    setLoading(true);
    setMessage("");
    setSuggestionsVisible(false);
    try {
      if (!(await requestWeatherAccess(true))) {
        setMessage(t("overview.weather.permissionDenied"));
        return;
      }
      const position = await currentPosition();
      const weather = await fetchWeatherForLocation({
        id: "current-position",
        label: t("overview.weather.currentLocation"),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }, locale);
      onQueryChange(weather.location);
      onSnapshot(weather);
    } catch {
      setMessage(t("overview.weather.geolocationFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section class="overview-card weather-card" aria-labelledby="weather-title">
      <header class="overview-card__header">
        <div>
          <p class="overview-card__eyebrow">{t("overview.weather.eyebrow")}</p>
          <h2 id="weather-title">{snapshot?.location ?? t("overview.weather.title")}</h2>
        </div>
        <button class="icon-button" type="button" onClick={() => void loadLocation(snapshot ? { id: "cached", label: snapshot.location, latitude: snapshot.latitude, longitude: snapshot.longitude, timezone: snapshot.timezone } : undefined)} disabled={loading} aria-label={t("overview.weather.refresh")} title={t("overview.weather.refresh")}>
          {loading ? "…" : "↻"}
        </button>
      </header>

      {snapshot ? (
        <>
          <div class="weather-current">
            <span class="weather-current__symbol" aria-hidden="true">{weatherSymbol(snapshot.current.code)}</span>
            <strong class="numeric">{Math.round(snapshot.current.temperature)}°</strong>
            <span>{weatherDescription(snapshot.current.code, locale)}<small>{t("overview.weather.feels", { value: Math.round(snapshot.current.apparentTemperature) })}</small></span>
          </div>
          <dl class="weather-metrics">
            <div><dt>{t("overview.weather.rain")}</dt><dd>{Math.round(snapshot.days[0]?.precipitationProbability ?? 0)}%</dd></div>
            <div><dt>{t("overview.weather.wind")}</dt><dd>{Math.round(snapshot.current.windSpeed)} km/h</dd></div>
            <div><dt>{t("overview.weather.humidity")}</dt><dd>{Math.round(snapshot.current.humidity)}%</dd></div>
            <div><dt>{t("overview.weather.sun")}</dt><dd>{snapshot.days[0] ? `${shortTime(snapshot.days[0].sunrise, locale)} / ${shortTime(snapshot.days[0].sunset, locale)}` : "—"}</dd></div>
          </dl>
          <div class="weather-days" aria-label={t("overview.weather.forecast")}>
            {snapshot.days.map((day) => (
              <div key={day.date} title={weatherDescription(day.code, locale)}>
                <span>{new Intl.DateTimeFormat(localeTag(locale), { weekday: "short" }).format(new Date(`${day.date}T12:00:00`))}</span>
                <b aria-hidden="true">{weatherSymbol(day.code)}</b>
                <small class="numeric">{Math.round(day.maximum)}°/{Math.round(day.minimum)}°</small>
              </div>
            ))}
          </div>
          <p class="weather-outdoor"><b>{t("overview.weather.outdoor")}</b> {outdoorHours.length ? outdoorHours.join(" · ") : t("overview.weather.noOutdoor")}</p>
        </>
      ) : (
        <p class="overview-card__empty">{t("overview.weather.empty")}</p>
      )}

      <div class="weather-location">
        <div class="weather-location__search">
          <input
            type="text"
            value={query}
            autocomplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsVisible && suggestions.length > 0}
            aria-controls="weather-location-suggestions"
            onFocus={() => setSuggestionsVisible(true)}
            onBlur={() => window.setTimeout(() => setSuggestionsVisible(false), 120)}
            onInput={(event) => { onQueryChange(event.currentTarget.value); setSuggestionsVisible(true); setSuggestions(localLocationSuggestions(event.currentTarget.value)); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void loadLocation(suggestions[0]); } else if (event.key === "Escape") setSuggestionsVisible(false); }}
            placeholder={t("overview.weather.locationPlaceholder")}
            aria-label={t("overview.weather.location")}
          />
          {suggestionsVisible && suggestions.length > 0 && (
            <div class="weather-suggestions" id="weather-location-suggestions" role="listbox">
              {suggestions.map((suggestion) => (
                <button type="button" role="option" key={suggestion.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onQueryChange(suggestion.label); void loadLocation(suggestion); }}>
                  <span aria-hidden="true">⌖</span>{suggestion.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button class="icon-button weather-location__current" type="button" onClick={() => void useCurrentLocation()} disabled={loading} aria-label={t("overview.weather.useLocation")} title={t("overview.weather.useLocation")}>◎</button>
        <button class="button button--small" type="button" onClick={() => void loadLocation(suggestions.find((item) => item.label === query))} disabled={loading}>{t("overview.weather.load")}</button>
      </div>
      <small class="overview-privacy">{t("overview.weather.privacy")}</small>
      {message && <p class="overview-message" role="status">{message}</p>}
    </section>
  );
}
