import { useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

export function useLocationTracking() {
  const { user } = useAuth();

  useEffect(() => {
    const controller = new AbortController();

    const trackLocation = async () => {
      try {
        // Get auth token if user is logged in
        let authHeader = '';
        if (user?.uid) {
          const token = await user.getIdToken();
          authHeader = `Bearer ${token}`;
        }

        // Send tracking data to server
        const response = await fetch('/api/users/track-location', {
          method: 'POST',
          cache: 'no-store',
          keepalive: true,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(authHeader && { 'Authorization': authHeader }),
          },
          body: JSON.stringify({
            pageUrl: typeof window !== 'undefined' ? window.location.pathname : '/',
          }),
        });

        if (!response.ok) {
          if (process.env.NODE_ENV !== 'production') {
            let errorMessage = '';
            try {
              const errorData = await response.json();
              errorMessage = errorData?.error || errorData?.message || '';
            } catch (parseError) {
              // Ignore JSON parsing errors for non-JSON responses
            }
            console.warn('Location tracking skipped:', errorMessage || response.status);
          }
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn('Location tracking skipped:', error?.message || error);
        }
      }
    };

    // Track location when component mounts
    trackLocation();

    return () => {
      controller.abort();
    };
  }, [user]);
}
