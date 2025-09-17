import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../generated/prisma';

// Import routes and middleware
import authRoutes from './routes/auth';
import { authenticateToken, optionalAuth } from './middleware/auth';

dotenv.config();

const app: Express = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // Cho phép cookies
  optionsSuccessStatus: 200
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Cookie parser middleware

// Routes
app.use('/api/auth', authRoutes);

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'Land Auction System API đang hoạt động',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test database connection
app.get('/api/test-db', async (req: Request, res: Response) => {
  try {
    // Kiểm tra kết nối database
    await prisma.$queryRaw`SELECT 1`;
    
    // Đếm số người dùng
    const userCount = await prisma.nguoi_dung.count();
    
    res.json({
      status: 'success',
      message: 'Kết nối database thành công',
      data: {
        totalUsers: userCount
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi kết nối database'
    });
  }
});

// Protected route example
app.get('/api/protected', authenticateToken, (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Bạn đã truy cập thành công route được bảo vệ',
    user: req.user
  });
});

// Public route with optional auth
app.get('/api/public', optionalAuth, (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Route công khai',
    isAuthenticated: !!req.user,
    user: req.user || null
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err.stack);
  
  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(400).json({
      status: 'error',
      message: 'Lỗi cơ sở dữ liệu'
    });
    return;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      status: 'error',
      message: 'Dữ liệu không hợp lệ'
    });
    return;
  }

  res.status(500).json({
    status: 'error',
    message: 'Đã xảy ra lỗi server'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} không tồn tại`
  });
});

// Function to create HTTPS server for development
const startHttpsServer = () => {
  const keyPath = path.join(__dirname, '../ssl/key.pem');
  const certPath = path.join(__dirname, '../ssl/cert.pem');

  // Check if SSL certificates exist
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const httpsServer = https.createServer(httpsOptions, app);
    
    httpsServer.listen(port, () => {
      console.log(`🔒[server]: HTTPS Server đang chạy tại https://localhost:${port}`);
      console.log(`📊[database]: Đã kết nối tới PostgreSQL`);
      console.log(`🍪[cookies]: HttpOnly secure cookies enabled`);
    });

    return httpsServer;
  } else {
    console.warn('⚠️ SSL certificates không tìm thấy. Tạo certificates để sử dụng HTTPS.');
    console.warn('📝 Chạy: npm run create-ssl-certs');
    return null;
  }
};

// Start server
const startServer = () => {
  // Check if HTTPS is requested
  if (process.argv.includes('--https') || process.env.HTTPS === 'true') {
    const httpsServer = startHttpsServer();
    if (!httpsServer) {
      console.log('Fallback to HTTP server...');
      startHttpServer();
    }
    return httpsServer;
  } else {
    return startHttpServer();
  }
};

// Start HTTP server
const startHttpServer = () => {
  const server = app.listen(port, () => {
    console.log(`⚡️[server]: HTTP Server đang chạy tại http://localhost:${port}`);
    console.log(`📊[database]: Đã kết nối tới PostgreSQL`);
    console.log(`⚠️[warning]: Sử dụng HTTP - cookies sẽ không secure`);
    console.log(`💡[tip]: Dùng --https flag để bật HTTPS cho secure cookies`);
  });
  return server;
};

const server = startServer();

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      console.log('HTTP/HTTPS server closed');
    });
  }
  
  await prisma.$disconnect();
  console.log('Database connection closed');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;