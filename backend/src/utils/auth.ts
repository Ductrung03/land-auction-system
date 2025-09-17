import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Khai báo JWT_SECRET với kiểu Secret của jsonwebtoken
const JWT_SECRET: jwt.Secret = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  ma_nguoi_dung: number;
  ten_dang_nhap: string;
  ho_ten: string;
  email?: string;
  vai_tro: string;
  iat?: number;
  exp?: number;
}

export class AuthUtils {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Compare password
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT token
  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'land-auction-system',
      audience: 'land-auction-users'
    } as jwt.SignOptions); // Ép kiểu options thành jwt.SignOptions
  }

  // Verify JWT token
  static verifyToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'land-auction-system',
      audience: 'land-auction-users'
    }) as JWTPayload;
  }

  // Generate secure cookie options
  static getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true',
      sameSite: 'strict' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: '/'
    };
  }
}