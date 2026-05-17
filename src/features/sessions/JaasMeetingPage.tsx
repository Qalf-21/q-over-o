import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Loader2, Video, X } from 'lucide-react';
import { sessionApi, type SessionJoinInfo } from '../../api/sessionApi';

type JitsiApi = {
  dispose: () => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        jwt: string;
        parentNode: HTMLElement;
        width: string;
        height: string;
        configOverwrite?: Record<string, unknown>;
        interfaceConfigOverwrite?: Record<string, unknown>;
      }
    ) => JitsiApi;
  }
}

const loadJaasScript = (appId: string) => new Promise<void>((resolve, reject) => {
  if (window.JitsiMeetExternalAPI) {
    resolve();
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[data-jaas-app-id="${appId}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(), { once: true });
    existing.addEventListener('error', () => reject(new Error('Failed to load video SDK')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = `https://8x8.vc/${appId}/external_api.js`;
  script.async = true;
  script.dataset.jaasAppId = appId;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('Failed to load video SDK'));
  document.head.appendChild(script);
});

export const JaasMeetingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [joinInfo, setJoinInfo] = useState<SessionJoinInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const startMeeting = async () => {
      if (!id) {
        setError('Missing session id');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await sessionApi.getJoinInfo(id);
        const info = response.data;
        if (!info) throw new Error('Join response was empty');
        if (cancelled) return;

        setJoinInfo(info);
        await loadJaasScript(info.appId);
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;

        apiRef.current?.dispose();
        apiRef.current = new window.JitsiMeetExternalAPI(info.domain, {
          roomName: info.roomName,
          jwt: info.jwt,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: true,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
          },
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not join this session');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    startMeeting();

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <Video className="h-5 w-5 text-indigo-300" />
          <div>
            <p className="text-sm font-semibold">Live Session</p>
            {joinInfo && (
              <p className="text-xs text-gray-400">{joinInfo.moderator ? 'Tutor moderator access' : 'Student access'}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          Leave
        </button>
      </header>

      <main className="relative h-[calc(100vh-3.5rem)]">
        <div ref={containerRef} className="h-full w-full" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
            <div className="flex items-center gap-3 text-gray-200">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
              <span>Preparing secure video room...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 px-4">
            <div className="max-w-md rounded-xl border border-red-400/30 bg-red-950/40 p-5 text-red-100">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <AlertCircle className="h-5 w-5" />
                Unable to join session
              </div>
              <p className="text-sm text-red-100/80">{error}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
