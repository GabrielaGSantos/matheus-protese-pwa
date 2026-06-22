CREATE TABLE IF NOT EXISTS public.telegram_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type TEXT NOT NULL,
    case_id UUID,
    success BOOLEAN NOT NULL,
    response TEXT,
    chat_id TEXT
);