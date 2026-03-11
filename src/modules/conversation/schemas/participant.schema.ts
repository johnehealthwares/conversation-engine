import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Participant {
  @Prop({ required: false })
  firstName?: string;

  @Prop({ required: false })
  lastName?: string;

  @Prop({ required: false })
  email?: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ParticipantDocument = Participant;
export const ParticipantSchema = SchemaFactory.createForClass(Participant);

ParticipantSchema.index(
  { email: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      $or: [
        { email: { $exists: true, $ne: null } },
        { phone: { $exists: true, $ne: null } }
      ]
    }
  }
);

// ensure at least one exists
ParticipantSchema.pre('validate', function (next) {
  if (!this.email && !this.phone) {
    throw new Error('Either email or phone must be provided');
  }
});