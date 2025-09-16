import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma';


dotenv.config();

const app: Express = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'Land Auction System API đang hoạt động',
    timestamp: new Date().toISOString()
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

// Error handling
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Đã xảy ra lỗi server'
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`⚡️[server]: Server đang chạy tại http://localhost:${port}`);
  console.log(`📊[database]: Đã kết nối tới PostgreSQL`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

export default app;