'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    const next = params.get('next') ?? '/';

    if (!token) {
      setError('Missing token in callback URL.');
      return;
    }

    document.cookie = `accessToken=${token}; path=/; SameSite=Lax`;
    document.cookie = `itom_accessToken=${token}; path=/; SameSite=Lax`;

    router.replace(next);
  }, [params, router]);

  return (
    <p style={{ color: error ? '#ff8888' : '#aab2cc' }}>
      {error ?? 'Signing you in…'}
    </p>
  );
}

export default function AuthCallbackPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Suspense fallback={<p style={{ color: '#aab2cc' }}>Signing you in…</p>}>
        <CallbackInner />
      </Suspense>
    </main>
  );
}
