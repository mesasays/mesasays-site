import { JsonLd } from "@/components/JsonLd";
import { formatDate, t, type Locale } from "@/lib/i18n";
import { FilmPlayer } from "@/components/FilmPlayer";
import { CHANNEL_URL, filmThumb, filmUploadDate, filmUrl, type Film } from "@/lib/restaurants/films";
import { absoluteUrl } from "@/lib/site";

function isoDuration(seconds: number) {
  return `PT${Math.floor(seconds / 60)}M${seconds % 60}S`;
}

export function RestaurantFilm({
  film,
  restaurantName,
  locale = "en",
}: {
  film: Film;
  restaurantName: string;
  locale?: Locale;
}) {
  const s = t(locale);
  const video = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: film.title,
    description: `${film.summary} A documentary by The Dining Dispatch about ${restaurantName}, Mexico City.`,
    thumbnailUrl: absoluteUrl(filmThumb(film.videoId)),
    uploadDate: filmUploadDate(film),
    duration: isoDuration(film.durationSeconds),
    contentUrl: filmUrl(film),
    embedUrl: `https://www.youtube-nocookie.com/embed/${film.videoId}`,
    publisher: { "@type": "Organization", name: "The Dining Dispatch", url: CHANNEL_URL },
    about: { "@type": "Restaurant", name: restaurantName },
  };
  return (
    <section className="ds-panel" style={{ marginBottom: 16 }} aria-label={s.film}>
      <JsonLd data={video} />
      <div className="ds-panel-head">
        <span className="ds-label">{s.film}</span>
        <span className="num">{formatDate(film.publishedAt, locale)}</span>
      </div>
      <FilmPlayer videoId={film.videoId} title={film.title} thumb={filmThumb(film.videoId)} />
      <div className="ds-row">
        <span className="ds-label">{film.title}</span>
        <a href={filmUrl(film)} className="ds-link" target="_blank" rel="noreferrer">
          {s.watchOnYoutube} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
