import { ChannelType } from "./enums";


export type Channel = {
  id: string;

  // Channel info
  name: string;
  type: ChannelType;

  // Provider info
  provider?: string; // e.g. Twilio, Sendchamp, Meta
  pseudoParticipantId: string; // e.g. Twilio, Sendchamp, Meta
  externalId?: string; // e.g. WhatsApp number or integration id

  // Configuration
  isActive: boolean;

  // Optional metadata
  metadata?: Record<string, any>;

  // Audit
  createdAt: Date;
  updatedAt: Date;
};