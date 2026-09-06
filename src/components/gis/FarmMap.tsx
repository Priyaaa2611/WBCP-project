import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import 'leaflet/dist/leaflet.css';
import { MapPin, Layers } from 'lucide-react';

// Fix for default Leaflet icon paths in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface FarmMapProps {
  onBoundaryCreated: (geoJson: any) => void;
}

const PRESET_LOCATIONS = [
  { name: 'Wardha', lat: 20.7453, lng: 78.6022 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { name: 'Akola', lat: 20.7002, lng: 77.0082 },
  { name: 'Punjab', lat: 30.9010, lng: 75.8573 }
];

type MapStyleKey = 'googleHybrid' | 'googleSat' | 'esriSat' | 'osm';

const MAP_TILES: Record<MapStyleKey, { name: string; url: string; attribution: string; maxZoom: number }> = {
  googleHybrid: {
    name: 'Google Satellite (Hybrid)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps Satellite',
    maxZoom: 20
  },
  googleSat: {
    name: 'Google Pure Satellite',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    maxZoom: 20
  },
  esriSat: {
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 19
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }
};

const MapController: React.FC<{ targetCenter: [number, number] | null }> = ({ targetCenter }) => {
  const map = useMap();
  useEffect(() => {
    if (targetCenter) {
      map.flyTo(targetCenter, 13, { duration: 1.5 });
    }
  }, [targetCenter, map]);
  return null;
};

// Map Component to attach Geoman controls
const GeomanControls: React.FC<{ onBoundaryCreated: (geoJson: any) => void }> = ({ onBoundaryCreated }) => {
  const map = useMap();

  useEffect(() => {
    map.pm.addControls({
      position: 'topright',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: true,
      drawCircle: false,
      drawText: false,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
    });

    map.pm.setPathOptions({
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.25,
      weight: 2
    });

    map.on('pm:create', (e) => {
      const geoJson = (e.layer as any).toGeoJSON();
      onBoundaryCreated(geoJson);

      e.layer.on('pm:edit', () => {
        onBoundaryCreated((e.layer as any).toGeoJSON());
      });
    });

    map.on('pm:remove', () => {
      onBoundaryCreated(null);
    });

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
      map.off('pm:remove');
    };
  }, [map, onBoundaryCreated]);

  return null;
};

export const FarmMap: React.FC<FarmMapProps> = ({ onBoundaryCreated }) => {
  const [mapReady, setMapReady] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('googleHybrid');

  const handleSelectPreset = (lat: number, lng: number) => {
    setFlyTarget([lat, lng]);
    const offset = 0.008;
    const syntheticPolygon = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lng - offset, lat - offset],
          [lng + offset, lat - offset],
          [lng + offset, lat + offset],
          [lng - offset, lat + offset],
          [lng - offset, lat - offset]
        ]]
      }
    };
    onBoundaryCreated(syntheticPolygon);
  };

  const currentTile = MAP_TILES[mapStyle];

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl relative border border-stone-800">
      {/* Top Left: Quick Location Presets Bar */}
      <div className="absolute top-3 left-3 z-[400] bg-stone-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-stone-800 flex items-center space-x-2 shadow-xl">
        <MapPin size={14} className="text-emerald-400 flex-shrink-0" />
        <span className="text-[11px] font-bold text-stone-300 mr-1 hidden sm:inline">Quick Farms:</span>
        <div className="flex items-center space-x-1.5">
          {PRESET_LOCATIONS.map((loc) => (
            <button
              key={loc.name}
              onClick={() => handleSelectPreset(loc.lat, loc.lng)}
              className="text-[10px] font-bold px-2 py-1 bg-stone-800 hover:bg-emerald-600 hover:text-white text-stone-300 rounded-lg border border-stone-700 transition-colors cursor-pointer"
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Top Center-Right: Map Layer Selector */}
      <div className="absolute top-3 right-16 z-[400] bg-stone-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-stone-800 flex items-center space-x-1.5 shadow-xl">
        <Layers size={13} className="text-emerald-400" />
        <select
          value={mapStyle}
          onChange={(e) => setMapStyle(e.target.value as MapStyleKey)}
          className="bg-transparent text-white text-[11px] font-bold focus:outline-none cursor-pointer"
          aria-label="Select Satellite Map Layer"
        >
          <option value="googleHybrid" className="bg-stone-900 text-white">🛰️ Google Satellite (Hybrid)</option>
          <option value="googleSat" className="bg-stone-900 text-white">🛰️ Google Pure Satellite</option>
          <option value="esriSat" className="bg-stone-900 text-white">🛰️ Esri World Satellite</option>
          <option value="osm" className="bg-stone-900 text-white">🗺️ OpenStreetMap</option>
        </select>
      </div>

      <MapContainer 
        center={[20.5937, 78.9629]} // Centered on India
        zoom={5} 
        minZoom={3}
        maxBounds={[[5.0, 65.0], [38.0, 100.0]]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%', zIndex: 10 }}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          key={mapStyle}
          url={currentTile.url}
          attribution={currentTile.attribution}
          maxZoom={currentTile.maxZoom}
        />
        
        <MapController targetCenter={flyTarget} />
        <GeomanControls onBoundaryCreated={onBoundaryCreated} />
      </MapContainer>
      
      {!mapReady && (
        <div className="absolute inset-0 bg-stone-900 flex items-center justify-center z-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};
