import type { TeachingMode } from '@/lib/supabase/tutors-utils';

// Tutors share an area and city, never a street address.
const MAP_COUNTRY = 'Pakistan';

/**
 * Where a tutor teaches in person.
 *
 *  - With NEXT_PUBLIC_GOOGLE_MAPS_API_KEY set: an embedded Google map
 *    (Maps Embed API) centred on the area and city.
 *  - Without a key: the area as text plus an "Open in Google Maps" link,
 *    so the page works and looks complete either way.
 *  - Online-only tutors: nothing is shown.
 */
export function TutorMap({
  name,
  mode,
  city,
  area,
}: {
  name: string;
  mode: TeachingMode | null;
  city: string | null;
  area: string | null;
}) {
  const teachesInPerson = mode === 'in_person' || mode === 'both';
  if (!teachesInPerson || (!city && !area)) return null;

  const label = [area, city].filter(Boolean).join(', ');
  const query = encodeURIComponent([area, city, MAP_COUNTRY].filter(Boolean).join(', '));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Where {name.split(' ')[0]} teaches</h2>
          <p className="text-sm text-muted-foreground">
            {label}
            {mode === 'both' ? ' (also teaches online)' : ''}
          </p>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline underline-offset-4"
        >
          Open in Google Maps →
        </a>
      </div>

      {apiKey ? (
        <iframe
          title={`Map of ${label}`}
          src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(
            apiKey
          )}&q=${query}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="w-full h-64 rounded-lg border"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Only the area is shown, not a home address. Use the link above to see
          it on a map.
        </p>
      )}
    </section>
  );
}