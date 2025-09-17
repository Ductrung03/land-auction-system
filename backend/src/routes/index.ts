import { Router } from 'express';
import healthRoutes from './healthRoutes';

const router = Router();

// Mount routes
router.use('/', healthRoutes);

// 404 handler2
router.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`
  });
});

export default router;