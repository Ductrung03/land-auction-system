import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { AuthUtils, JWTPayload } from '../utils/auth';

const prisma = new PrismaClient();

// Extend Express Request type để thêm user property
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & {
        trang_thai_tai_khoan?: boolean;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload & {
    trang_thai_tai_khoan?: boolean;
  };
}

// Middleware để verify JWT token
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Token xác thực không tồn tại. Vui lòng đăng nhập.'
      });
      return;
    }

    // Verify token
    const decoded = AuthUtils.verifyToken(token);
    
    // Kiểm tra user có tồn tại và active không
    const user = await prisma.nguoi_dung.findUnique({
      where: { ma_nguoi_dung: decoded.ma_nguoi_dung },
      select: {
        ma_nguoi_dung: true,
        ten_dang_nhap: true,
        ho_ten: true,
        email: true,
        vai_tro: true,
        trang_thai_tai_khoan: true
      }
    });

    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Người dùng không tồn tại'
      });
      return;
    }

    if (!user.trang_thai_tai_khoan) {
      res.status(401).json({
        status: 'error',
        message: 'Tài khoản đã bị khóa'
      });
      return;
    }

    // Gắn thông tin user vào request
    req.user = {
      ...decoded,
      trang_thai_tai_khoan: user.trang_thai_tai_khoan
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({
        status: 'error',
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.'
      });
      return;
    }

    if (error instanceof Error && (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError')) {
      res.status(401).json({
        status: 'error',
        message: 'Token không hợp lệ'
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Lỗi xác thực'
    });
  }
};

// Middleware để kiểm tra quyền admin
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.vai_tro !== 'admin') {
    res.status(403).json({
      status: 'error',
      message: 'Không có quyền truy cập. Chỉ admin mới được phép.'
    });
    return;
  }
  next();
};

// Middleware để kiểm tra quyền staff hoặc admin
export const requireStaff = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !['admin', 'staff'].includes(req.user.vai_tro)) {
    res.status(403).json({
      status: 'error',
      message: 'Không có quyền truy cập. Chỉ staff và admin mới được phép.'
    });
    return;
  }
  next();
};

// Middleware kiểm tra optional authentication (không bắt buộc đăng nhập)
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.auth_token;
    
    if (token) {
      const decoded = AuthUtils.verifyToken(token);
      const user = await prisma.nguoi_dung.findUnique({
        where: { ma_nguoi_dung: decoded.ma_nguoi_dung },
        select: {
          ma_nguoi_dung: true,
          ten_dang_nhap: true,
          ho_ten: true,
          email: true,
          vai_tro: true,
          trang_thai_tai_khoan: true
        }
      });

      if (user && user.trang_thai_tai_khoan) {
        req.user = {
          ...decoded,
          trang_thai_tai_khoan: user.trang_thai_tai_khoan
        };
      }
    }
    
    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};