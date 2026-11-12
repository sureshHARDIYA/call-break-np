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
        'flex flex-col rounded-xl border border-white/12 bg-[#0F1C16] text-[#F4F1EA] overflow-hidden',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-[#F4F1EA]">Table Chat</h3>
          <p className="text-[11px] text-[#8DA499]">Live room messages</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#9EB3A8] hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Message stream */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 min-h-[200px]">
        {messages.map((msg) => {
          if (msg.kind === 'system') {
            return (
              <div
                key={msg.id}
                className="text-center text-[11px] text-[#8DA499] py-0.5"
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
              <div className="flex items-center gap-1.5 text-[11px] text-[#8DA499] mb-0.5">
                <span className="font-medium text-[#C5D4CC]">
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
                  'rounded-lg px-3 py-1.5 text-xs sm:text-sm break-words',
                  isMe
                    ? 'bg-[#D99B26] text-[#0B1410] font-medium'
                    : 'bg-[#192D24] text-[#F4F1EA] border border-white/8'
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
      <div className="h-5 px-4 flex items-center text-[11px] text-[#9EB3A8]">
        {activeTypers.length > 0 && (
          <span>
            {activeTypers.map((t) => t.displayName).join(', ')}{' '}
            {activeTypers.length === 1 ? 'is' : 'are'} typing…
          </span>
        )}
      </div>

      {/* Quick chat replies */}
      <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto">
        {QUICK_REPLIES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => onSendMessage(phrase)}
            className="whitespace-nowrap shrink-0 rounded-md border border-white/10 bg-[#15271E] px-2.5 py-1 text-[11px] text-[#C5D4CC] hover:bg-[#1D3529] hover:text-white transition-colors cursor-pointer"
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-white/10 p-2.5 bg-[#0B1410]"
      >
        <Input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Message the table…"
          maxLength={300}
          className="h-9 text-xs sm:text-sm"
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
