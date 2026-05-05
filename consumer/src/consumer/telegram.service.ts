import { Injectable } from '@nestjs/common';

export interface TelegramMessage {
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableNotification?: boolean;
}

export interface TelegramKnownChat {
  id: string;
  type: string;
  displayName: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phoneNumber?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
}

interface TelegramGetUpdatesResponse extends TelegramApiResponse {
  result?: TelegramUpdate[];
}

interface TelegramUpdate {
  message?: TelegramUpdateMessage;
  edited_message?: TelegramUpdateMessage;
  channel_post?: TelegramUpdateMessage;
  edited_channel_post?: TelegramUpdateMessage;
  my_chat_member?: TelegramChatMemberUpdate;
  chat_member?: TelegramChatMemberUpdate;
}

interface TelegramUpdateMessage {
  chat?: TelegramApiChat;
  from?: TelegramApiUser;
  contact?: TelegramApiContact;
}

interface TelegramChatMemberUpdate {
  chat?: TelegramApiChat;
}

interface TelegramApiChat {
  id: number | string;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramApiUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramApiContact {
  user_id?: number;
  phone_number?: string;
}

@Injectable()
export class TelegramService {
  private readonly apiUrl = process.env.TELEGRAM_API_URL ?? 'https://api.telegram.org';
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly broadcastChatIds = process.env.TELEGRAM_BROADCAST_CHAT_IDS ?? '';

  async sendMessage(chatId: string, message: TelegramMessage): Promise<void> {
    await this.callTelegram<TelegramApiResponse>('sendMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message.text,
        parse_mode: message.parseMode,
        disable_notification: message.disableNotification,
      }),
    });
  }

  async getKnownChats(): Promise<TelegramKnownChat[]> {
    const body = await this.callTelegram<TelegramGetUpdatesResponse>('getUpdates', {
      cache: 'no-store',
    });
    const chats = new Map<string, TelegramKnownChat>();

    for (const update of body.result ?? []) {
      this.collectMessageChat(chats, update.message);
      this.collectMessageChat(chats, update.edited_message);
      this.collectMessageChat(chats, update.channel_post);
      this.collectMessageChat(chats, update.edited_channel_post);
      this.collectApiChat(chats, update.my_chat_member?.chat);
      this.collectApiChat(chats, update.chat_member?.chat);
    }

    return [...chats.values()].sort((first, second) =>
      first.displayName.localeCompare(second.displayName),
    );
  }

  getBroadcastChatIds(): string[] {
    return this.broadcastChatIds
      .split(',')
      .map((chatId) => chatId.trim())
      .filter(Boolean);
  }

  isConfigured(): boolean {
    return Boolean(this.botToken);
  }

  private async callTelegram<TResponse extends TelegramApiResponse>(
    method: string,
    init?: RequestInit,
  ): Promise<TResponse> {
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const response = await fetch(`${this.apiUrl}/bot${this.botToken}/${method}`, init);
    const body = (await response.json()) as TResponse;

    if (!response.ok || !body.ok) {
      throw new Error(body.description ?? `Telegram API failed with status ${response.status}`);
    }

    return body;
  }

  private collectMessageChat(
    chats: Map<string, TelegramKnownChat>,
    message?: TelegramUpdateMessage,
  ): void {
    const chat = this.collectApiChat(chats, message?.chat);

    if (!chat || !message) {
      return;
    }

    const phoneNumber = this.getPhoneNumber(message, chat.id);

    if (phoneNumber) {
      chats.set(chat.id, {
        ...chat,
        phoneNumber,
      });
    }
  }

  private collectApiChat(
    chats: Map<string, TelegramKnownChat>,
    apiChat?: TelegramApiChat,
  ): TelegramKnownChat | undefined {
    if (!apiChat) {
      return undefined;
    }

    const chat = this.toKnownChat(apiChat);
    const existingChat = chats.get(chat.id);
    const mergedChat = {
      ...chat,
      ...existingChat,
      phoneNumber: existingChat?.phoneNumber ?? chat.phoneNumber,
    };

    chats.set(chat.id, mergedChat);

    return mergedChat;
  }

  private toKnownChat(chat: TelegramApiChat): TelegramKnownChat {
    const id = String(chat.id);
    const firstName = chat.first_name;
    const lastName = chat.last_name;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const usernameLabel = chat.username ? `@${chat.username}` : '';
    const displayName = chat.title || fullName || usernameLabel || `Chat ${id}`;

    return {
      id,
      type: chat.type,
      displayName,
      username: chat.username,
      firstName,
      lastName,
      title: chat.title,
    };
  }

  private getPhoneNumber(
    message: TelegramUpdateMessage,
    chatId: string,
  ): string | undefined {
    const contact = message.contact;

    if (!contact?.phone_number || String(contact.user_id) !== chatId) {
      return undefined;
    }

    return contact.phone_number;
  }
}
