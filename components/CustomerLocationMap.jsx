'use client';
import React, { useMemo, useState } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';

export default function CustomerLocationMap({ locations = [] }) {
  const [selectedMarker, setSelectedMarker] = useState(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    id: 'Store1920-google-maps',
    googleMapsApiKey: apiKey || '',
  });

  if (!apiKey) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
        <p>⚠️ Google Maps API key not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local</p>
      </div>
    );
  }

  // Filter locations with valid coordinates
  const validLocations = locations.filter((loc) => loc.latitude && loc.longitude);

  if (validLocations.length === 0) {
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
        <p>No location data with coordinates available</p>
      </div>
    );
  }

  // Calculate map center (average of all locations)
  const center = useMemo(() => {
    const avgLat =
      validLocations.reduce((sum, loc) => sum + loc.latitude, 0) /
      validLocations.length;
    const avgLng =
      validLocations.reduce((sum, loc) => sum + loc.longitude, 0) /
      validLocations.length;
    return { lat: avgLat, lng: avgLng };
  }, [validLocations]);

  const mapOptions = {
    zoom: 4,
    center: center,
    mapTypeId: 'roadmap',
    styles: [
      {
        featureType: 'all',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#616161' }],
      },
    ],
  };

  // Group locations by coordinates to show count
  const locationGroups = {};
  validLocations.forEach((loc) => {
    const key = `${loc.latitude},${loc.longitude}`;
    if (!locationGroups[key]) {
      locationGroups[key] = {
        ...loc,
        count: 0,
        locations: [],
      };
    }
    locationGroups[key].count += 1;
    locationGroups[key].locations.push(loc);
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Customer Locations Map</h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span>Single Visit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>Multiple Visits</span>
          </div>
        </div>
      </div>

      {!isLoaded ? (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
          <p>Loading map...</p>
        </div>
      ) : (
        <GoogleMap mapContainerClassName="w-full rounded-lg border border-gray-200 shadow-sm" mapContainerStyle={{ height: '500px' }} options={mapOptions}>
          {Object.values(locationGroups).map((group, idx) => (
            <MarkerF
              key={idx}
              position={{ lat: group.latitude, lng: group.longitude }}
              onClick={() => setSelectedMarker(group)}
              icon={
                group.count > 1
                  ? {
                      path: window.google?.maps?.SymbolPath?.CIRCLE,
                      scale: 8,
                      fillColor: '#ef4444',
                      fillOpacity: 0.8,
                      strokeColor: '#fff',
                      strokeWeight: 2,
                    }
                  : {
                      path: window.google?.maps?.SymbolPath?.CIRCLE,
                      scale: 6,
                      fillColor: '#3b82f6',
                      fillOpacity: 0.8,
                      strokeColor: '#fff',
                      strokeWeight: 2,
                    }
              }
            >
              {selectedMarker?.latitude === group.latitude &&
                selectedMarker?.longitude === group.longitude && (
                  <InfoWindowF
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="p-2 text-sm max-w-xs">
                      <p className="font-semibold text-gray-900">
                        {group.city}, {group.country}
                      </p>
                      <p className="text-gray-600">{group.deviceType}</p>
                      <p className="text-gray-600">{group.browser}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {group.count} visit{group.count > 1 ? 's' : ''} from this location
                      </p>
                      <div className="mt-2 space-y-1 text-xs">
                        {group.locations.slice(0, 3).map((loc, i) => (
                          <p key={i} className="text-gray-500">
                            {new Date(loc.timestamp).toLocaleDateString()} at{' '}
                            {new Date(loc.timestamp).toLocaleTimeString()}
                          </p>
                        ))}
                        {group.locations.length > 3 && (
                          <p className="text-gray-500">
                            +{group.locations.length - 3} more visits
                          </p>
                        )}
                      </div>
                    </div>
                  </InfoWindowF>
                )}
            </MarkerF>
          ))}
        </GoogleMap>
      )}

      {/* Location Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-blue-900">Total Visits</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{validLocations.length}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm font-medium text-green-900">Unique Locations</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {Object.keys(locationGroups).length}
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm font-medium text-purple-900">Avg Visits/Location</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {(
              validLocations.length / Object.keys(locationGroups).length
            ).toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}
