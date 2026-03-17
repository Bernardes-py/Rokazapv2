import { MapPin } from 'lucide-react';

interface LocationBubbleProps {
  latitude: number;
  longitude: number;
  locationTitle?: string;
  locationAddress?: string;
  body?: string;
}

export default function LocationBubble({ latitude, longitude, locationTitle, locationAddress, body }: LocationBubbleProps) {
  const title = locationTitle || body || 'Localização';
  const gmapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const delta = 0.002;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div className="rounded overflow-hidden mb-1">
      <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
        <iframe
          src={embedUrl}
          className="w-full h-[150px] border-0 pointer-events-none"
          title={`Mapa: ${title}`}
          loading="lazy"
        />
      </a>
      <div className="bg-black/10 px-3 py-2 space-y-0.5">
        <p className="font-semibold text-sm leading-tight flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          {title}
        </p>
        {locationAddress && (
          <p className="text-xs text-whatsapp-muted leading-snug">{locationAddress}</p>
        )}
      </div>
    </div>
  );
}
