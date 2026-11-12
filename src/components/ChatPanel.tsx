import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { ChatMessage, SeatIndex } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { Button } from './ui/button.tsx';
import { Input } from './ui/input.tsx';

interface ChatPanelProps {
  messages: ChatMessage[];
  mySeat: SeatIndex | null;
  typingUsers: Record<number, { seat: SeatIndex; displayName: string }>;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onClose?: () => void;
  className?: string;
}

const QUICK_REPLIES = ['Good luck!', 'Nice trump!', 'Well played', 'GG'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  mySeat,
  typingUsers,
  onSendMessage,
  onTyping,
  onClose,
  className,
}) => {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const activeTypers = Object.values(typingUsers).filter(
    (t) => t.seat !== mySeat
  );

  const handleDraftChange = (val: string) => {
    setDraft(val);
    onTyping(val.trim().length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setDraft('');
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-line bg-surface text-ink overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface-muted/60">
        <div>
          <h3 className="text-base font-semibold text-ink">Table Chat</h3>
          <p className="text-xs text-ink-muted">Live room messages</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted hover:bg-tint hover:text-brand-ink-strong cursor-pointer"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-[200px]">
        {messages.map((msg) => {
          if (msg.kind === 'system') {
            return (
              <div
                key={msg.id}
                className="text-center text-xs text-ink-muted py-0.5"
              >
                {msg.text}
              </div>
            );
          }

          const isMe = msg.senderSeat !== null && msg.senderSeat === mySeat;
          return (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[88%]',
                isMe ? 'ml-auto items-end' : 'mr-auto items-start'
              )}
            >
              <div className="flex items-center gap-1.5 text-xs text-ink-muted mb-1">
                <span className="font-semibold text-ink-2">
                  {isMe ? 'You' : msg.senderName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className={cn(
                  'rounded-lg px-3.5 py-2 text-sm break-words',
                  isMe
                    ? 'bg-brand text-white font-medium'
                    : 'bg-surface-muted text-ink border border-line'
                )}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <div className="h-5 px-4 flex items-center text-xs text-brand-ink font-medium">
        {activeTypers.length > 0 && (
          <span>
            {activeTypers.map((t) => t.displayName).join(', ')}{' '}
            {activeTypers.length === 1 ? 'is' : 'are'} typing…
          </span>
        )}
      </div>

      {/* Quick chat replies */}
      <div className="px-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
        {QUICK_REPLIES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => onSendMessage(phrase)}
            className="whitespace-nowrap shrink-0 rounded-md border border-line bg-surface-muted px-3 py-1 text-xs font-medium text-ink hover:bg-tint hover:border-brand-ink hover:text-brand-ink-strong transition-colors cursor-pointer"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-line p-2.5 bg-surface-muted/50"
      >
        <Input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Message the table…"
          maxLength={300}
          className="h-10 text-sm"
        />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0" aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
