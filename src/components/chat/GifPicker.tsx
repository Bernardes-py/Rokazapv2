import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

// Tenor API v2 - publishable key (user must replace with their own)
const TENOR_API_KEY = 'AIzaSyA_YOUR_TENOR_KEY_HERE';
const TENOR_CLIENT_KEY = 'lovable_whatsapp';
const TENOR_LIMIT = 30;

interface TenorMedia {
  url: string;
  dims: number[];
  duration: number;
  size: number;
}

interface TenorResult {
  id: string;
  media_formats: {
    gif?: TenorMedia;
    tinygif?: TenorMedia;
    mp4?: TenorMedia;
    tinymp4?: TenorMedia;
    nanogif?: TenorMedia;
  };
  content_description: string;
}

interface GifPickerProps {
  onSelectGif: (gifUrl: string) => void;
}

export default function GifPicker({ onSelectGif }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TenorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchGifs = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError('');
    try {
      const endpoint = searchQuery.trim()
        ? 'search'
        : 'featured';
      const params = new URLSearchParams({
        key: TENOR_API_KEY,
        client_key: TENOR_CLIENT_KEY,
        media_filter: 'tinygif,mp4',
        limit: String(TENOR_LIMIT),
        locale: 'pt_BR',
      });
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }

      const res = await fetch(
        `https://tenor.googleapis.com/v2/${endpoint}?${params.toString()}`
      );
      if (!res.ok) throw new Error(`Tenor API error: ${res.status}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      console.error('[GifPicker] Erro:', err);
      setError('Erro ao buscar GIFs. Verifique a API Key do Tenor.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load with trending
  useEffect(() => {
    fetchGifs('');
  }, [fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGifs(query);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchGifs]);

  const handleSelect = (result: TenorResult) => {
    // Z-API expects MP4 for GIFs
    const mp4Url = result.media_formats?.mp4?.url;
    if (mp4Url) {
      onSelectGif(mp4Url);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-whatsapp-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar GIFs..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-whatsapp-search text-sm text-whatsapp-text outline-none placeholder:text-whatsapp-muted"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {loading && results.length === 0 ? (
          <div className="grid grid-cols-3 gap-1 p-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-whatsapp-muted text-sm px-4 text-center">
            <p>{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-whatsapp-muted text-sm">
            <p>Nenhum GIF encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 p-3">
            {results.map((result) => {
              const preview = result.media_formats?.tinygif?.url || result.media_formats?.nanogif?.url;
              if (!preview || !result.media_formats?.mp4?.url) return null;
              return (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity bg-whatsapp-hover"
                  title={result.content_description}
                >
                  <img
                    src={preview}
                    alt={result.content_description}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
        {loading && results.length > 0 && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-whatsapp-muted" />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
