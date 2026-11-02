'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getContacts,
  getConversations,
  getThread,
  sendMessage,
  startConversation,
  reportMessage,
  type ChatMessage,
  type Contact,
  type ConversationSummary,
} from '@/lib/supabase/messages';
import {
  MAX_MESSAGE_LENGTH,
  formatMessageTime,
} from '@/lib/supabase/messages-utils';
import { Button } from '@/components/ui/button';

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [me, setMe] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  const selectedRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    const [convs, cts] = await Promise.all([getConversations(), getContacts()]);
    setConversations(convs);
    setContacts(cts);
    setLoading(false);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const thread = await getThread(id);
    // Ignore the result if the user already switched to another conversation
    if (selectedRef.current !== id) return;
    setMe(thread.me);
    setMessages(thread.messages);
  }, []);

  // Conversation list: load once, then refresh every 10 seconds
  useEffect(() => {
    refreshList();
    const timer = setInterval(refreshList, 10000);
    return () => clearInterval(timer);
  }, [refreshList]);

  // Open thread: load, then poll every 5 seconds
  useEffect(() => {
    selectedRef.current = selectedId;
    setMessages([]);
    setReportingId(null);
    if (!selectedId) return;

    loadThread(selectedId).then(() => refreshList());
    const timer = setInterval(() => loadThread(selectedId), 5000);
    return () => clearInterval(timer);
  }, [selectedId, loadThread, refreshList]);

  // Keep the newest message in view
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, selectedId]);

  async function handleStart(contact: Contact) {
    setError(null);
    const res = await startConversation(contact.user_id);
    if (res.error || !res.conversationId) {
      setError(res.error ?? 'Could not start the conversation.');
      return;
    }
    setShowPicker(false);
    await refreshList();
    setSelectedId(res.conversationId);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || sending) return;
    const text = draft.trim();
    if (!text) {
      setError('Write a message first.');
      return;
    }
    setSending(true);
    setError(null);
    const res = await sendMessage(selectedId, text);
    setSending(false);
    if (!res.success) {
      setError(res.error ?? 'Could not send the message.');
      return;
    }
    setDraft('');
    await loadThread(selectedId);
    refreshList();
  }

  async function handleReport(messageId: string) {
    setError(null);
    const res = await reportMessage(messageId, reportReason);
    if (!res.success) {
      setError(res.error ?? 'Could not send the report.');
      return;
    }
    setReportingId(null);
    setReportReason('');
    setNotice('Thanks, the message has been reported for review.');
    setTimeout(() => setNotice(null), 5000);
  }

  const current = conversations.find((c) => c.conversation_id === selectedId);

  let lastMineIndex = -1;
  messages.forEach((m, i) => {
    if (m.sender_id === me) lastMineIndex = i;
  });

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Messages</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Private conversations between parents and their children&apos;s
              teachers.
            </p>
          </div>
          <Link
            href="/protected"
            className="text-sm underline underline-offset-4"
          >
            ← Dashboard
          </Link>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-green-700">{notice}</p>}

        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          {/* Conversation list */}
          <div className={`rounded-lg border ${selectedId ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="font-medium">Conversations</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPicker((v) => !v)}
              >
                {showPicker ? 'Close' : '+ New'}
              </Button>
            </div>

            {showPicker && (
              <div className="p-3 border-b bg-muted/30">
                {contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    There is nobody to message yet. A parent can message a
                    teacher once the teacher is linked to their child, and a
                    teacher can message the parents of their linked students.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      Who do you want to message?
                    </p>
                    {contacts.map((c) => (
                      <button
                        key={c.user_id}
                        type="button"
                        onClick={() => handleStart(c)}
                        className="text-left rounded border bg-background p-2 hover:bg-muted"
                      >
                        <p className="text-sm font-medium">{c.full_name}</p>
                        {c.context && (
                          <p className="text-xs text-muted-foreground">
                            {c.context}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No conversations yet. Use &quot;+ New&quot; to start one.
              </p>
            ) : (
              <div className="flex flex-col">
                {conversations.map((c) => {
                  const unread =
                    c.conversation_id !== selectedId ? c.unread_count : 0;
                  return (
                    <button
                      key={c.conversation_id}
                      type="button"
                      onClick={() => setSelectedId(c.conversation_id)}
                      className={`text-left p-3 border-b last:border-b-0 hover:bg-muted ${
                        c.conversation_id === selectedId ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {c.other_name}
                        </p>
                        {unread > 0 && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                      {c.context && (
                        <p className="text-xs text-muted-foreground truncate">
                          {c.context}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {c.last_body ?? 'No messages yet'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Thread */}
          <div
            className={`rounded-lg border flex-col h-[70vh] ${
              selectedId ? 'flex' : 'hidden md:flex'
            }`}
          >
            {!selectedId || !current ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-sm text-muted-foreground text-center">
                  Select a conversation, or start a new one.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 border-b">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="md:hidden text-sm underline underline-offset-4"
                  >
                    ← Back
                  </button>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{current.other_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {current.context ?? 'No longer linked'}
                    </p>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-3 flex flex-col gap-3"
                >
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      No messages yet. Say hello.
                    </p>
                  ) : (
                    messages.map((m, i) => {
                      const mine = m.sender_id === me;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            mine ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                              mine
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {m.body}
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                            <span>{formatMessageTime(m.created_at)}</span>
                            {mine && i === lastMineIndex && m.read_at && (
                              <span>Seen</span>
                            )}
                            {!mine && (
                              <button
                                type="button"
                                className="underline underline-offset-2"
                                onClick={() => {
                                  setReportingId(m.id);
                                  setReportReason('');
                                }}
                              >
                                Report
                              </button>
                            )}
                          </div>
                          {reportingId === m.id && (
                            <div className="mt-2 flex flex-wrap gap-2 w-full max-w-[80%]">
                              <input
                                type="text"
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                maxLength={500}
                                placeholder="What is wrong with this message?"
                                className="flex-1 min-w-[160px] rounded border px-2 py-1 text-sm bg-background"
                              />
                              <Button size="sm" onClick={() => handleReport(m.id)}>
                                Send report
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReportingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {current.can_send ? (
                  <form onSubmit={handleSend} className="border-t p-3 flex flex-col gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                      maxLength={MAX_MESSAGE_LENGTH}
                      rows={2}
                      placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
                      className="w-full rounded border px-3 py-2 text-sm bg-background resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {draft.length}/{MAX_MESSAGE_LENGTH}
                      </span>
                      <Button type="submit" size="sm" disabled={sending}>
                        {sending ? 'Sending…' : 'Send'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="border-t p-3 text-sm text-muted-foreground">
                    You can no longer message this person because your link has
                    ended. You can still read this conversation.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}