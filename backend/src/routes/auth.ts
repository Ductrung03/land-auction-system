import express, { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { AuthUtils } from '../utils/auth';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Validation helpers
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPassword = (password: string): boolean => {
  // Ít nhất 6 ký tự, có chữ và số
  return password.length >= 6 && /^(?=.*[A-Za-z])(?=.*\d)/.test(password);
};

const isValidUsername = (username: string): boolean => {
  // 3-50 ký tự, chỉ chứa chữ, số, dấu gạch dưới
  return /^[a-zA-Z0-9_]{3,50}$/.test(username);
};

// Đăng ký tài khoản mới
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      ten_dang_nhap,
      mat_khau,
      ho_ten,
      email,
      so_dien_thoai,
      so_cccd,
      dia_chi
    } = req.body;

    // Validation
    if (!ten_dang_nhap || !mat_khau || !ho_ten) {
      res.status(400).json({
        status: 'error',
        message: 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc'
      });
      return;
    }

    if (!isValidUsername(ten_dang_nhap)) {
      res.status(400).json({
        status: 'error',
        message: 'Tên đăng nhập phải có 3-50 ký tự và chỉ chứa chữ, số, dấu gạch dưới'
      });
      return;
    }

    if (!isValidPassword(mat_khau)) {
      res.status(400).json({
        status: 'error',
        message: 'Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số'
      });
      return;
    }

    if (email && !isValidEmail(email)) {
      res.status(400).json({
        status: 'error',
        message: 'Email không hợp lệ'
      });
      return;
    }

    // Kiểm tra tên đăng nhập đã tồn tại
    const existingUser = await prisma.nguoi_dung.findFirst({
      where: {
        OR: [
          { ten_dang_nhap },
          ...(email ? [{ email }] : []),
          ...(so_cccd ? [{ so_cccd }] : [])
        ]
      }
    });

    if (existingUser) {
      let message = 'Tên đăng nhập đã tồn tại';
      if (existingUser.email === email) message = 'Email đã được sử dụng';
      if (existingUser.so_cccd === so_cccd) message = 'Số CCCD đã được sử dụng';
      
      res.status(409).json({
        status: 'error',
        message
      });
      return;
    }

    // Hash mật khẩu
    const mat_khau_hash = await AuthUtils.hashPassword(mat_khau);

    // Tạo user mới
    const newUser = await prisma.nguoi_dung.create({
      data: {
        ten_dang_nhap,
        mat_khau_hash,
        ho_ten,
        email: email || null,
        so_dien_thoai: so_dien_thoai || null,
        so_cccd: so_cccd || null,
        dia_chi: dia_chi || null,
        vai_tro: 'user',
        nguoi_tao: 1 // System user
      },
      select: {
        ma_nguoi_dung: true,
        ten_dang_nhap: true,
        ho_ten: true,
        email: true,
        vai_tro: true,
        ngay_tao: true
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Đăng ký tài khoản thành công',
      data: {
        user: newUser
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi server khi đăng ký tài khoản'
    });
  }
});

// Đăng nhập
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ten_dang_nhap, mat_khau } = req.body;

    if (!ten_dang_nhap || !mat_khau) {
      res.status(400).json({
        status: 'error',
        message: 'Tên đăng nhập và mật khẩu là bắt buộc'
      });
      return;
    }

    // Tìm user
    const user = await prisma.nguoi_dung.findUnique({
      where: { ten_dang_nhap },
      select: {
        ma_nguoi_dung: true,
        ten_dang_nhap: true,
        mat_khau_hash: true,
        ho_ten: true,
        email: true,
        vai_tro: true,
        trang_thai_tai_khoan: true
      }
    });

    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
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

    // Kiểm tra mật khẩu
    const isPasswordValid = await AuthUtils.comparePassword(mat_khau, user.mat_khau_hash);
    
    if (!isPasswordValid) {
      res.status(401).json({
        status: 'error',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
      return;
    }

    // Cập nhật lần đăng nhập cuối
    await prisma.nguoi_dung.update({
      where: { ma_nguoi_dung: user.ma_nguoi_dung },
      data: { lan_dang_nhap_cuoi: new Date() }
    });

    // Tạo JWT token
    const token = AuthUtils.generateToken({
      ma_nguoi_dung: user.ma_nguoi_dung,
      ten_dang_nhap: user.ten_dang_nhap,
      ho_ten: user.ho_ten,
      email: user.email || undefined,
      vai_tro: user.vai_tro || 'user'
    });

    // Set cookie
    res.cookie('auth_token', token, AuthUtils.getCookieOptions());

    res.json({
      status: 'success',
      message: 'Đăng nhập thành công',
      data: {
        user: {
          ma_nguoi_dung: user.ma_nguoi_dung,
          ten_dang_nhap: user.ten_dang_nhap,
          ho_ten: user.ho_ten,
          email: user.email,
          vai_tro: user.vai_tro
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi server khi đăng nhập'
    });
  }
});

// Đăng xuất
// Improved logout route - thêm vào src/routes/auth.ts
router.post('/logout', (_req: Request, res: Response): void => {
  // Clear cookie với multiple methods để ensure removal
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true',
    sameSite: 'strict',
    path: '/'
  });

  // Backup method: Set cookie with immediate expiration
  res.cookie('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // Immediate expiration
    expires: new Date(0) // Set to past date
  });

  res.json({
    status: 'success',
    message: 'Đăng xuất thành công'
  });
});

// Lấy thông tin user hiện tại
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user; // Ép kiểu req thành AuthenticatedRequest
    const userData = await prisma.nguoi_dung.findUnique({
      where: { ma_nguoi_dung: user.ma_nguoi_dung },
      select: {
        ma_nguoi_dung: true,
        ten_dang_nhap: true,
        ho_ten: true,
        email: true,
        so_dien_thoai: true,
        dia_chi: true,
        vai_tro: true,
        lan_dang_nhap_cuoi: true,
        ngay_tao: true
      }
    });

    if (!userData) {
      res.status(404).json({
        status: 'error',
        message: 'Người dùng không tồn tại'
      });
      return;
    }

    res.json({
      status: 'success',
      data: { user: userData }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi server khi lấy thông tin người dùng'
    });
  }
});

// Đổi mật khẩu
router.put('/change-password', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthenticatedRequest).user; // Ép kiểu req thành AuthenticatedRequest
    const { mat_khau_cu, mat_khau_moi } = req.body;

    if (!mat_khau_cu || !mat_khau_moi) {
      res.status(400).json({
        status: 'error',
        message: 'Mật khẩu cũ và mật khẩu mới là bắt buộc'
      });
      return;
    }

    if (!isValidPassword(mat_khau_moi)) {
      res.status(400).json({
        status: 'error',
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự, bao gồm chữ và số'
      });
      return;
    }

    // Lấy mật khẩu hiện tại
    const userData = await prisma.nguoi_dung.findUnique({
      where: { ma_nguoi_dung: user.ma_nguoi_dung },
      select: { mat_khau_hash: true }
    });

    if (!userData) {
      res.status(404).json({
        status: 'error',
        message: 'Người dùng không tồn tại'
      });
      return;
    }

    // Kiểm tra mật khẩu cũ
    const isOldPasswordValid = await AuthUtils.comparePassword(mat_khau_cu, userData.mat_khau_hash);
    
    if (!isOldPasswordValid) {
      res.status(400).json({
        status: 'error',
        message: 'Mật khẩu cũ không đúng'
      });
      return;
    }

    // Hash mật khẩu mới
    const mat_khau_hash_moi = await AuthUtils.hashPassword(mat_khau_moi);

    // Cập nhật mật khẩu
    await prisma.nguoi_dung.update({
      where: { ma_nguoi_dung: user.ma_nguoi_dung },
      data: {
        mat_khau_hash: mat_khau_hash_moi,
        ngay_cap_nhat: new Date()
      }
    });

    res.json({
      status: 'success',
      message: 'Đổi mật khẩu thành công'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi server khi đổi mật khẩu'
    });
  }
});

export default router;