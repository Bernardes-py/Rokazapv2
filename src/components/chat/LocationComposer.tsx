import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { MapPin, Send, Search, Loader2, Navigation, AlertCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LocationComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (title: string, address: string, latitude: number, longitude: number) => void;
}

interface SelectedLocation {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
}

const NOMINATIM_HEADERS = { 'Accept-Language': 'pt-BR', 'User-Agent': 'LovableChat/1.0' };

export default function LocationComposer({ open, onOpenChange, onSend }: LocationComposerProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<SelectedLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Request GPS on open
  useEffect(() => {
    if (!open) return;
    setGpsLoading(true);
    setGpsError(null);
    setGpsLocation(null);
    setSelectedLocation(null);
    setSearchQuery('');
    setSearchResults([]);
    setCustomTitle('');

    if (!navigator.geolocation) {
      setGpsError('Geolocalização não suportada neste navegador.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: NOMINATIM_HEADERS }
          );
          const data = await res.json();
          setGpsLocation({
            title: data.name || data.address?.road || 'Minha localização',
            address: data.display_name || `${latitude}, ${longitude}`,
            latitude,
            longitude,
          });
        } catch {
          setGpsLocation({
            title: 'Minha localização',
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            latitude,
            longitude,
          });
        }
        setGpsLoading(false);
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'Permissão de localização negada.',
          2: 'Localização indisponível.',
          3: 'Tempo esgotado ao buscar localização.',
        };
        setGpsError(msgs[err.code] || 'Erro ao obter localização.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [open]);

  // Marker drag handler (stable ref for leaflet event)
  const handleMarkerDrag = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: NOMINATIM_HEADERS }
      );
      const data = await res.json();
      setSelectedLocation({
        title: data.name || data.address?.road || 'Local selecionado',
        address: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        latitude: lat,
        longitude: lng,
      });
      setCustomTitle(data.name || data.address?.road || 'Local selecionado');
    } catch {
      setSelectedLocation(prev => prev ? { ...prev, latitude: lat, longitude: lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` } : null);
    }
  }, []);

  // Keep a ref to the latest handleMarkerDrag so the leaflet listener always calls the latest version
  const handleMarkerDragRef = useRef(handleMarkerDrag);
  handleMarkerDragRef.current = handleMarkerDrag;

  // Initialize / update / destroy Leaflet map imperatively
  useEffect(() => {
    if (!selectedLocation) {
      // Destroy map when no location selected
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const container = mapContainerRef.current;
    if (!container) return;

    const { latitude, longitude } = selectedLocation;

    if (!mapRef.current) {
      // Create map
      const map = L.map(container, { zoomControl: true, attributionControl: false }).setView([latitude, longitude], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        handleMarkerDragRef.current(pos.lat, pos.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Leaflet needs a resize after the container is visible
      setTimeout(() => map.invalidateSize(), 100);
    } else {
      // Update existing map
      mapRef.current.setView([latitude, longitude], 15);
      markerRef.current?.setLatLng([latitude, longitude]);
    }
  }, [selectedLocation]);

  // Cleanup on unmount / dialog close
  useEffect(() => {
    if (!open && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
  }, [open]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=5&addressdetails=1`,
          { headers: NOMINATIM_HEADERS }
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 500);
  }, []);

  const selectResult = (result: NominatimResult) => {
    const loc: SelectedLocation = {
      title: result.name || result.display_name.split(',')[0],
      address: result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
    setSelectedLocation(loc);
    setCustomTitle(loc.title);
    setSearchQuery('');
    setSearchResults([]);
  };

  const selectGps = () => {
    if (!gpsLocation) return;
    setSelectedLocation(gpsLocation);
    setCustomTitle(gpsLocation.title);
  };

  const handleSend = () => {
    if (!selectedLocation) return;
    const title = customTitle.trim() || selectedLocation.title;
    onSend(title, selectedLocation.address, selectedLocation.latitude, selectedLocation.longitude);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-whatsapp-header border-whatsapp-border text-whatsapp-text max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-whatsapp-text">
            <MapPin className="h-5 w-5 text-orange-500" />
            Enviar Localização
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* GPS Section */}
          {gpsLoading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-whatsapp-search">
              <Loader2 className="h-5 w-5 animate-spin text-whatsapp-green" />
              <span className="text-sm text-whatsapp-muted">Obtendo localização...</span>
            </div>
          )}

          {gpsError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-whatsapp-search">
              <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
              <span className="text-sm text-whatsapp-muted">{gpsError}</span>
            </div>
          )}

          {gpsLocation && !selectedLocation && (
            <Button
              onClick={selectGps}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 border-whatsapp-border bg-whatsapp-search hover:bg-whatsapp-hover text-whatsapp-text"
            >
              <Navigation className="h-5 w-5 text-whatsapp-green shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-medium text-sm">Enviar minha localização</div>
                <div className="text-xs text-whatsapp-muted truncate">{gpsLocation.address}</div>
              </div>
            </Button>
          )}

          {!selectedLocation && (
            <>
              <div className="flex items-center gap-2">
                <Separator className="flex-1 bg-whatsapp-border" />
                <span className="text-xs text-whatsapp-muted whitespace-nowrap">ou buscar um lugar</span>
                <Separator className="flex-1 bg-whatsapp-border" />
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-whatsapp-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar endereço ou lugar..."
                  className="pl-9 bg-whatsapp-search border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted"
                />
              </div>

              {searching && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-whatsapp-muted" />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map((r) => (
                    <button
                      key={r.place_id}
                      onClick={() => selectResult(r)}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-whatsapp-hover transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-whatsapp-text truncate">
                            {r.name || r.display_name.split(',')[0]}
                          </div>
                          <div className="text-xs text-whatsapp-muted truncate">{r.display_name}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Selected location with interactive map */}
          {selectedLocation && (
            <div className="space-y-3">
              <div
                ref={mapContainerRef}
                className="w-full h-[200px] rounded-lg overflow-hidden border border-whatsapp-border"
              />

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-whatsapp-muted">Arraste o pin para ajustar a posição</p>
                {gpsLocation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-whatsapp-green hover:text-whatsapp-green/80"
                    onClick={() => {
                      setSelectedLocation(gpsLocation);
                      setCustomTitle(gpsLocation.title);
                    }}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Recentrar
                  </Button>
                )}
              </div>
              <div className="text-xs text-whatsapp-muted truncate">{selectedLocation.address}</div>

              <div>
                <label className="text-xs text-whatsapp-muted mb-1 block">Título</label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Nome do local"
                  className="bg-whatsapp-search border-whatsapp-border text-whatsapp-text placeholder:text-whatsapp-muted"
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedLocation(null); setCustomTitle(''); }}
                className="text-whatsapp-muted hover:text-whatsapp-text text-xs"
              >
                ← Escolher outro local
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={!selectedLocation}
            className="bg-whatsapp-green hover:bg-whatsapp-green/90 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar Localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
