import { useEffect, useRef } from 'react';
import { supabase } from '../services/api';
import { RealtimeChannel } from '@supabase/supabase-js';

type RealtimePayload = {
  new: any;
  old: any;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
};

export const useRealtime = (
  table: string,
  onUpdate: () => void,
  onSpecificUpdate?: (payload: RealtimePayload) => void
) => {
  const onUpdateRef = useRef(onUpdate);
  const onSpecificUpdateRef = useRef(onSpecificUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onSpecificUpdateRef.current = onSpecificUpdate;
  }, [onUpdate, onSpecificUpdate]);

  useEffect(() => {
    if (!supabase) return;

    const channel: RealtimeChannel = supabase.channel(`public:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table },
        (payload: any) => {
          if (onSpecificUpdateRef.current) {
            onSpecificUpdateRef.current(payload);
          }
          if (onUpdateRef.current) {
            onUpdateRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [table]);
};
