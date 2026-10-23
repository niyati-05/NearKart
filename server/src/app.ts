import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { errorHandler } from './middleware/error.js';
import { notFoundHandler } from './middleware/notFound.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { storeRouter } from './modules/store/store.routes.js';
import {
  publicProductRouter,
  sellerProductRouter,
} from './modules/product/product.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import {
  customerOrderRouter,
  sellerOrderRouter,
} from './modules/order/order.routes.js';
import { deliveryRouter } from './modules/delivery/delivery.routes.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/stores', storeRouter);
  app.use('/api/products', publicProductRouter);
  app.use('/api/seller/products', sellerProductRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/delivery', deliveryRouter);
  app.use('/api/orders', customerOrderRouter);
  app.use('/api/seller/orders', sellerOrderRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
