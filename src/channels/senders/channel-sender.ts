import { ParticipantDomain } from "../../shared/domain";
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
  sendMessage(participant: ParticipantDomain, title: string, message: string, containsLink: boolean, context: Record<string, any>): Promise<void>;
  sendMedia?(participant: ParticipantDomain, payload: SendMediaPayload): Promise<void>;
}
