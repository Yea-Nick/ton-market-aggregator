'use client';

import { useEffect, useState } from 'react';
import { formatUiDateTime } from '@/lib/chart';

interface ClientDateTimeProps {
    value: string | null;
    fallback?: string;
}

export function ClientDateTime({
    value,
    fallback = '—',
}: ClientDateTimeProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !value) {
        return <>{fallback}</>;
    }

    return <>{formatUiDateTime(value)}</>;
}