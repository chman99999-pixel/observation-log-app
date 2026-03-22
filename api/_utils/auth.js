import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const JWT_EXPIRES_IN = '7d';

export function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, 10);
}

export function verifyPassword(plainPassword, storedPassword) {
  // bcrypt 해시인 경우 ($2a$ 또는 $2b$ 로 시작)
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(plainPassword, storedPassword);
  }
  // 레거시 평문 비밀번호 (마이그레이션 전환기)
  return plainPassword === storedPassword;
}

export function isHashed(password) {
  return password.startsWith('$2a$') || password.startsWith('$2b$');
}

export function createToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, organization: user.organization, provider: user.provider || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 요청에서 JWT 토큰 추출 및 검증
export function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return verifyToken(authHeader.slice(7));
}

// 사용자 객체에서 민감 정보 제거
export function sanitizeUser(user) {
  const { password, password_hash, ...safe } = user;
  return safe;
}
