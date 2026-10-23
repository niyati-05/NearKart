import { ObjectId } from 'mongodb';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * ObjectId.isValid() also accepts some non-hex strings, so be explicit here.
 * Invalid ids must become a 400 response, never a driver exception.
 */
export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

export function toObjectId(value: string): ObjectId {
  return new ObjectId(value);
}
