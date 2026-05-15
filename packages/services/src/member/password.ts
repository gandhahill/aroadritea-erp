import bcrypt from 'bcryptjs';

const MEMBER_BCRYPT_COST = 12;

export async function hashMemberPassword(password: string): Promise<string> {
  return bcrypt.hash(password, MEMBER_BCRYPT_COST);
}
