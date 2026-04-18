import { ChannelDomain, ParticipantDomain } from "../../shared/domain";
import type { Express } from 'express';

export type SendMediaPayload = {
  documentType: string;
  title: string;
  message: string;
  file?: Express.Multer.File;
  fileUrl?: string;
  fileName?: string;
  context?: Record<string, any>;
};

export interface ChannelSender {
  sendMessage(sender: ParticipantDomain, receiver: ParticipantDomain, title: string, message: string, context: Record<string, any>): Promise<void>;
  sendMedia(sender: ParticipantDomain, receiver: ParticipantDomain, payload: SendMediaPayload): Promise<void>;
  getChannel(): ChannelDomain;
  getPseudoParticipant(): ParticipantDomain;
}
