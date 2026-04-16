import { ExchangeDirection, ExchangeStatus } from "./enums";
import { Types } from "mongoose";

export type Exchange = {
  id: string;

  channelId?: string;
  channelType: string;

  direction: ExchangeDirection;
  status: ExchangeStatus;

  receiverId?: string;
  senderId?: string;

  messageId: string;
  message: string;

  conversationId?: string;
  questionnaireCode?: string;

  context?: Record<string, any>;
  payload?: Record<string, any>;
  result?: Record<string, any>;

  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
};