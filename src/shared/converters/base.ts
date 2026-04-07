import { Schema as MongooseSchema, Types } from 'mongoose';

export const toDomain = (doc: any): any => {
  if (!doc) return doc;
  const obj = doc.toObject?.() ?? doc;

  if (Array.isArray(obj)) return obj.map(toDomain);

  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => k !== '__v')
      .map(([k, v]) => {
        const key = k === '_id' ? 'id' : k;
        if (v instanceof Types.ObjectId) return [key, v.toString()];
        if (Array.isArray(v)) return [key, v.map(toDomain)];
        if (v && typeof v === 'object') return [key, toDomain(v)];
        return [key, v];
      })
  );
};