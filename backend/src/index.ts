import express, { Express } from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { corsMiddleware } from './middleware/corsConfig';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { db } from './services/database';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(corsMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', routes);

// Error handling middleware (phải đặt cuối cùng)
app.use(errorHandler);

// Start server
const server = app.listen(port, () => {
  console.log(`⚡️ [Server]: Đang chạy tại http://localhost:${port}`);
  console.log(`📊 [Database]: Kết nối PostgreSQL thành công`);
  console.log(`🌍 [CORS]: Cho phép origin ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
  console.log(`🔧 [Environment]: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} nhận được. Đang đóng server...`);
  
  server.close(async () => {
    console.log('HTTP server đã đóng');
    
    try {
      await db.disconnect();
      console.log('Đã ngắt kết nối database');
    } catch (error) {
      console.error('Lỗi khi ngắt kết nối database:', error);
    }
    
    process.exit(0);
  });

  // Force shutdown sau 10 giây
  setTimeout(() => {
    console.error('Buộc tắt server do timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;