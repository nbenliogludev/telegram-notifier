'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type TargetType = 'single' | 'broadcast';
type ParseMode = '' | 'HTML' | 'Markdown' | 'MarkdownV2';

interface PublishResponse {
  eventId?: string;
  status?: string;
  exchange?: string;
  routingKey?: string;
  message?: string | string[];
  statusCode?: number;
}

interface HealthState {
  ok: boolean;
  label: string;
}

interface TelegramChat {
  id: string;
  type: string;
  displayName: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phoneNumber?: string;
}

const emptyResult = {
  status: 'idle',
};

export default function Home() {
  const [targetType, setTargetType] = useState<TargetType>('single');
  const [chatId, setChatId] = useState('123456789');
  const [message, setMessage] = useState('Hello from Telegramify');
  const [parseMode, setParseMode] = useState<ParseMode>('HTML');
  const [eventId, setEventId] = useState('');
  const [disableNotification, setDisableNotification] = useState(false);
  const [metadata, setMetadata] = useState('{\n  "source": "panel"\n}');
  const [result, setResult] = useState<PublishResponse>(emptyResult);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [chatError, setChatError] = useState('');
  const [health, setHealth] = useState<HealthState>({
    ok: false,
    label: 'checking',
  });
  const selectedChat = chats.find((chat) => chat.id === chatId.trim());

  const preview = useMemo(() => {
    const payload: Record<string, unknown> = {
      targetType,
      message,
    };

    if (targetType === 'single') {
      payload.chatId = chatId;
    }

    if (parseMode) {
      payload.parseMode = parseMode;
    }

    if (eventId) {
      payload.eventId = eventId;
    }

    payload.disableNotification = disableNotification;

    const parsedMetadata = parseMetadata(metadata);
    if (parsedMetadata) {
      payload.metadata = parsedMetadata;
    }

    return payload;
  }, [chatId, disableNotification, eventId, message, metadata, parseMode, targetType]);

  useEffect(() => {
    let isMounted = true;

    fetch('/api/producer-health')
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (!isMounted) {
          return;
        }

        setHealth({
          ok,
          label: ok ? `${body.service}: ${body.status}` : 'unavailable',
        });
      })
      .catch(() => {
        if (isMounted) {
          setHealth({
            ok: false,
            label: 'unavailable',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void loadChats();
  }, []);

  async function loadChats() {
    setChatError('');
    setIsLoadingChats(true);

    try {
      const response = await fetch('/api/telegram-chats', {
        cache: 'no-store',
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(formatError(body));
      }

      const loadedChats = Array.isArray(body) ? (body as TelegramChat[]) : [];

      setChats(loadedChats);

      if (!chatId.trim() && loadedChats[0]) {
        setChatId(loadedChats[0].id);
      }
    } catch (loadError) {
      setChatError(loadError instanceof Error ? loadError.message : 'Could not load chats');
    } finally {
      setIsLoadingChats(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSending(true);

    try {
      if (!message.trim()) {
        throw new Error('Message is required');
      }

      if (targetType === 'single' && !chatId.trim()) {
        throw new Error('Chat ID is required');
      }

      const parsedMetadata = parseMetadata(metadata, true);
      const payload: Record<string, unknown> = {
        targetType,
        message: message.trim(),
        disableNotification,
      };

      if (targetType === 'single') {
        payload.chatId = chatId.trim();
      }

      if (parseMode) {
        payload.parseMode = parseMode;
      }

      if (eventId.trim()) {
        payload.eventId = eventId.trim();
      }

      if (parsedMetadata) {
        payload.metadata = parsedMetadata;
      }

      const response = await fetch('/api/telegram-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as PublishResponse;

      setResult(body);

      if (!response.ok) {
        throw new Error(formatError(body));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Request failed');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Telegramify Panel</h1>
          <span>Producer notification tester</span>
        </div>
        <div className="status">
          <span className={`status-dot ${health.ok ? 'ok' : 'fail'}`} />
          <span>{health.label}</span>
        </div>
      </header>

      <section className="workspace">
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <h2>Notification</h2>

          <div className="field">
            <label>Target</label>
            <div className="segmented" role="tablist" aria-label="Notification target">
              <button
                className={targetType === 'single' ? 'active' : ''}
                onClick={() => setTargetType('single')}
                type="button"
              >
                Single chat
              </button>
              <button
                className={targetType === 'broadcast' ? 'active' : ''}
                onClick={() => setTargetType('broadcast')}
                type="button"
              >
                Broadcast
              </button>
            </div>
          </div>

          {targetType === 'single' ? (
            <>
              <div className="field">
                <label htmlFor="chatSelect">Recipient</label>
                <div className="recipient-row">
                  <select
                    disabled={isLoadingChats}
                    id="chatSelect"
                    onChange={(event) => setChatId(event.target.value)}
                    value={selectedChat ? selectedChat.id : ''}
                  >
                    <option value="">Manual chat ID</option>
                    {chats.map((chat) => (
                      <option key={chat.id} value={chat.id}>
                        {formatChatOption(chat)}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button"
                    disabled={isLoadingChats}
                    onClick={() => void loadChats()}
                    type="button"
                  >
                    {isLoadingChats ? 'Loading' : 'Refresh'}
                  </button>
                </div>
                {selectedChat ? (
                  <div className="chat-summary">
                    <span>{selectedChat.displayName}</span>
                    <span>{formatChatDetails(selectedChat)}</span>
                  </div>
                ) : (
                  <p className="muted">
                    {chats.length === 0 ? 'No known chats yet' : 'Manual recipient'}
                  </p>
                )}
                {chatError ? <p className="error-text">{chatError}</p> : null}
              </div>

              <div className="field">
                <label htmlFor="chatId">Chat ID</label>
                <input
                  id="chatId"
                  onChange={(event) => setChatId(event.target.value)}
                  placeholder="123456789"
                  value={chatId}
                />
              </div>
            </>
          ) : null}

          <div className="field">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              onChange={(event) => setMessage(event.target.value)}
              value={message}
            />
          </div>

          <div className="field">
            <label htmlFor="parseMode">Parse mode</label>
            <select
              id="parseMode"
              onChange={(event) => setParseMode(event.target.value as ParseMode)}
              value={parseMode}
            >
              <option value="">None</option>
              <option value="HTML">HTML</option>
              <option value="Markdown">Markdown</option>
              <option value="MarkdownV2">MarkdownV2</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="eventId">Event ID</label>
            <input
              id="eventId"
              onChange={(event) => setEventId(event.target.value)}
              placeholder="Generated when empty"
              value={eventId}
            />
          </div>

          <div className="field">
            <label htmlFor="metadata">Metadata JSON</label>
            <textarea
              id="metadata"
              onChange={(event) => setMetadata(event.target.value)}
              value={metadata}
            />
          </div>

          <label className="row">
            <input
              checked={disableNotification}
              onChange={(event) => setDisableNotification(event.target.checked)}
              type="checkbox"
            />
            <span>Silent notification</span>
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="actions">
            <button className="primary-button" disabled={isSending} type="submit">
              {isSending ? 'Sending' : 'Send notification'}
            </button>
          </div>
        </form>

        <aside className="result-stack">
          <section className="panel">
            <h2>Response</h2>
            <pre className="result-box">{JSON.stringify(result, null, 2)}</pre>
          </section>

          <section className="panel">
            <h2>Payload</h2>
            <pre className="result-box">{JSON.stringify(preview, null, 2)}</pre>
          </section>
        </aside>
      </section>
    </main>
  );
}

function parseMetadata(value: string, shouldThrow = false): Record<string, unknown> | undefined {
  if (!value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    throw new Error('Metadata must be a JSON object');
  } catch (error) {
    if (shouldThrow) {
      throw error;
    }

    return undefined;
  }
}

function formatError(response: PublishResponse) {
  if (Array.isArray(response.message)) {
    return response.message.join(', ');
  }

  return response.message ?? 'Request failed';
}

function formatChatOption(chat: TelegramChat) {
  const username = chat.username ? ` @${chat.username}` : '';

  return `${chat.displayName}${username} (${chat.id})`;
}

function formatChatDetails(chat: TelegramChat) {
  const details = [
    chat.username ? `@${chat.username}` : undefined,
    chat.phoneNumber ? `phone ${chat.phoneNumber}` : undefined,
    chat.type,
    chat.id,
  ].filter(Boolean);

  return details.join(' | ');
}
