import { Request, Response } from 'express';
import { db } from '../services/database';
import os from 'os';

export class HealthController {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  public getHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const dbConnected = await db.checkConnection();
      const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      
      const healthData = {
        status: dbConnected ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: uptimeSeconds,
          human: this.formatUptime(uptimeSeconds)
        },
        database: {
          connected: dbConnected,
          status: dbConnected ? 'connected' : 'disconnected'
        },
        system: {
          platform: os.platform(),
          memory: {
            free: Math.round(os.freemem() / 1024 / 1024),
            total: Math.round(os.totalmem() / 1024 / 1024),
            usage: `${Math.round((1 - os.freemem() / os.totalmem()) * 100)}%`
          },
          cpuCount: os.cpus().length
        },
        environment: process.env.NODE_ENV || 'development'
      };

      res.status(dbConnected ? 200 : 503).json(healthData);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Không thể kiểm tra sức khỏe hệ thống',
        timestamp: new Date().toISOString()
      });
    }
  };

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0) parts.push(`${hours} giờ`);
    if (minutes > 0) parts.push(`${minutes} phút`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs} giây`);

    return parts.join(', ');
  }
}