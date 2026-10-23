import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ObjectId } from 'mongodb';
import request from 'supertest';

// Must be set before the app/config modules are imported.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB = 'nearkart_test';
process.env.BCRYPT_SALT_ROUNDS = '10';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

const { createApp } = await import('../src/app.js');
const { connectToDatabase, closeDatabase, getDb } = await import(
  '../src/db/client.js'
);
const { initializeCollections } = await import('../src/db/init.js');
const { verifyPassword } = await import('../src/modules/auth/auth.utils.js');
const { createUser } = await import('../src/modules/auth/auth.service.js');
const { toPublicUser } = await import('../src/modules/auth/auth.types.js');
const { env } = await import('../src/config/env.js');
const {
  calculateDeliveryFeePaise,
  isDeliveryQuoteBlocking,
  quoteDeliveryForStore,
} = await import('../src/modules/delivery/delivery.service.js');

const app = createApp();

const ADMIN_EMAIL = 'admin@nearkart.test';
const ADMIN_PASSWORD = 'AdminPass123!';

before(async () => {
  const { db } = await connectToDatabase();
  await db.dropDatabase(); // test database only: nearkart_test
  await initializeCollections(db);

  const admin = await createUser(
    { fullName: 'Test Admin', email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    'admin',
  );
  assert.equal(toPublicUser(admin).role, 'admin');
});

after(async () => {
  await getDb().dropDatabase();
  await closeDatabase();
});

describe('health endpoint', () => {
  it('reports backend and database status separately', async () => {
    const response = await request(app).get('/api/health').expect(200);
    assert.equal(response.body.backend.status, 'ok');
    assert.equal(response.body.database.status, 'connected');
    assert.equal(response.body.status, 'ok');
  });
});

describe('registration', () => {
  it('registers a customer, hashes the password and sets a session cookie', async () => {
    const response = await request(app)
      .post('/api/auth/register/customer')
      .send({
        fullName: 'Customer One',
        email: 'customer@nearkart.test',
        password: 'CustomerPass123!',
        phone: '+919876543210',
      })
      .expect(201);

    assert.equal(response.body.user.role, 'customer');
    assert.equal(response.body.user.email, 'customer@nearkart.test');
    assert.equal(response.body.user.passwordHash, undefined);

    const cookie = response.headers['set-cookie']?.[0] ?? '';
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const stored = await getDb()
      .collection('users')
      .findOne({ email: 'customer@nearkart.test' });
    assert.ok(stored);
    assert.notEqual(stored.passwordHash, 'CustomerPass123!');
    assert.equal(
      await verifyPassword('CustomerPass123!', stored.passwordHash as string),
      true,
    );
  });

  it('rejects duplicate emails with 409', async () => {
    const response = await request(app)
      .post('/api/auth/register/customer')
      .send({
        fullName: 'Customer Duplicate',
        email: 'customer@nearkart.test',
        password: 'AnotherPass123!',
      })
      .expect(409);

    assert.equal(response.body.error.code, 'EMAIL_EXISTS');
  });

  it('rejects weak passwords with 400', async () => {
    const response = await request(app)
      .post('/api/auth/register/customer')
      .send({
        fullName: 'Weak Password',
        email: 'weak@nearkart.test',
        password: 'short',
      })
      .expect(400);

    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  });

  it('registers a seller with the seller role only', async () => {
    const response = await request(app)
      .post('/api/auth/register/seller')
      .send({
        fullName: 'Seller One',
        email: 'seller@nearkart.test',
        password: 'SellerPass123!',
        role: 'admin',
      })
      .expect(201);

    assert.equal(response.body.user.role, 'seller');
  });

  it('has no public driver or admin registration route', async () => {
    await request(app)
      .post('/api/auth/register/driver')
      .send({})
      .expect(404);
    await request(app)
      .post('/api/auth/register/admin')
      .send({})
      .expect(404);
  });
});

describe('login and sessions', () => {
  it('rejects a wrong password with a generic 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@nearkart.test', password: 'WrongPass123!' })
      .expect(401);

    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
    assert.match(response.body.error.message, /invalid email or password/i);
  });

  it('rejects /me without a session', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('logs a customer in, restores /me and logs out', async () => {
    const agent = request.agent(app);

    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'customer@nearkart.test', password: 'CustomerPass123!' })
      .expect(200);
    assert.equal(login.body.user.role, 'customer');

    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.user.email, 'customer@nearkart.test');

    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
});

describe('role restrictions', () => {
  let customerAgent: ReturnType<typeof request.agent>;
  let sellerAgent: ReturnType<typeof request.agent>;
  let adminAgent: ReturnType<typeof request.agent>;
  let driverAgent: ReturnType<typeof request.agent>;

  before(async () => {
    customerAgent = request.agent(app);
    await customerAgent
      .post('/api/auth/login')
      .send({ email: 'customer@nearkart.test', password: 'CustomerPass123!' })
      .expect(200);

    sellerAgent = request.agent(app);
    await sellerAgent
      .post('/api/auth/login')
      .send({ email: 'seller@nearkart.test', password: 'SellerPass123!' })
      .expect(200);

    adminAgent = request.agent(app);
    await adminAgent
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
  });

  it('blocks customers from administrative endpoints', async () => {
    const response = await customerAgent
      .post('/api/auth/admin/drivers')
      .send({
        fullName: 'Illegal Driver',
        email: 'illegal@nearkart.test',
        password: 'DriverPass123!',
      })
      .expect(403);
    assert.equal(response.body.error.code, 'FORBIDDEN');
  });

  it('blocks sellers from creating drivers or admins', async () => {
    await sellerAgent
      .post('/api/auth/admin/drivers')
      .send({
        fullName: 'Seller Driver',
        email: 'seller-driver@nearkart.test',
        password: 'DriverPass123!',
      })
      .expect(403);

    await sellerAgent
      .post('/api/auth/admin/admins')
      .send({
        fullName: 'Seller Admin',
        email: 'seller-admin@nearkart.test',
        password: 'AdminPass123!',
      })
      .expect(403);
  });

  it('lets an admin create a driver, who can log in but not create accounts', async () => {
    const created = await adminAgent
      .post('/api/auth/admin/drivers')
      .send({
        fullName: 'Driver One',
        email: 'driver@nearkart.test',
        password: 'DriverPass123!',
      })
      .expect(201);

    assert.equal(created.body.user.role, 'driver');

    driverAgent = request.agent(app);
    const login = await driverAgent
      .post('/api/auth/login')
      .send({ email: 'driver@nearkart.test', password: 'DriverPass123!' })
      .expect(200);
    assert.equal(login.body.user.role, 'driver');

    await driverAgent
      .post('/api/auth/admin/drivers')
      .send({
        fullName: 'Driver Two',
        email: 'driver-two@nearkart.test',
        password: 'DriverPass123!',
      })
      .expect(403);
  });

  it('lets an admin create another admin', async () => {
    const response = await adminAgent
      .post('/api/auth/admin/admins')
      .send({
        fullName: 'Second Admin',
        email: 'admin-two@nearkart.test',
        password: 'AdminPass456!',
      })
      .expect(201);

    assert.equal(response.body.user.role, 'admin');
  });

  it('does not leak password hashes in any user response', async () => {
    const response = await adminAgent.get('/api/auth/me').expect(200);
    assert.equal(response.body.user.passwordHash, undefined);
  });
});


describe('stores and products', () => {
  let sellerAAgent: ReturnType<typeof request.agent>;
  let sellerBAgent: ReturnType<typeof request.agent>;
  let customerAgent: ReturnType<typeof request.agent>;
  let sellerAId = '';
  let sellerBId = '';
  let storeAId = '';
  let storeBId = '';
  let riceId = '';
  let earbudsId = '';
  let notebookId = '';

  const riceInput = {
    name: 'Basmati Rice 5kg',
    description: 'Aged long-grain basmati rice for everyday meals.',
    categoryId: 'groceries',
    pricePaise: 49900,
    stock: 12,
    imageUrl: 'https://images.example.com/products/basmati-rice.jpg',
    lowStockThreshold: 5,
  };

  const earbudsInput = {
    name: 'Wireless Earbuds',
    description: 'Bluetooth earbuds with a charging case and clear calls.',
    categoryId: 'electronics',
    pricePaise: 299900,
    stock: 0,
    imageUrl: 'https://images.example.com/products/earbuds.jpg',
    lowStockThreshold: 5,
  };

  const notebookInput = {
    name: 'A5 Notebook',
    description: 'Ruled notebook with 200 pages and a hard cover.',
    categoryId: 'books',
    pricePaise: 12000,
    stock: 3,
    imageUrl: 'https://images.example.com/products/notebook.jpg',
    lowStockThreshold: 5,
  };

  const applesInput = {
    name: 'Fresh Apples 1kg',
    description: 'Crisp apples packed the same day they are received.',
    categoryId: 'groceries',
    pricePaise: 19900,
    stock: 20,
    imageUrl: 'https://images.example.com/products/apples.jpg',
    lowStockThreshold: 5,
  };

  before(async () => {
    sellerAAgent = request.agent(app);
    const sellerA = await sellerAAgent
      .post('/api/auth/register/seller')
      .send({
        fullName: 'Phase Four Seller A',
        email: 'phase4.seller.a@nearkart.test',
        password: 'SellerPass123!',
      })
      .expect(201);
    sellerAId = sellerA.body.user.id;

    sellerBAgent = request.agent(app);
    const sellerB = await sellerBAgent
      .post('/api/auth/register/seller')
      .send({
        fullName: 'Phase Four Seller B',
        email: 'phase4.seller.b@nearkart.test',
        password: 'SellerPass123!',
      })
      .expect(201);
    sellerBId = sellerB.body.user.id;

    customerAgent = request.agent(app);
    await customerAgent
      .post('/api/auth/register/customer')
      .send({
        fullName: 'Phase Four Customer',
        email: 'phase4.customer@nearkart.test',
        password: 'CustomerPass123!',
      })
      .expect(201);
  });

  it('requires a store profile before a seller can add a product', async () => {
    const response = await sellerAAgent
      .post('/api/seller/products')
      .send(riceInput)
      .expect(409);

    assert.equal(response.body.error.code, 'STORE_REQUIRED');
  });

  it('blocks customers from store and product management', async () => {
    await customerAgent
      .post('/api/stores')
      .send({ name: 'Illegal Store', city: 'Pune' })
      .expect(403);

    await customerAgent.post('/api/seller/products').send(riceInput).expect(403);
    await customerAgent
      .patch('/api/seller/products/64b000000000000000000000')
      .send({ stock: 1 })
      .expect(403);
    await customerAgent
      .delete('/api/seller/products/64b000000000000000000000')
      .expect(403);
    await customerAgent.get('/api/seller/products').expect(403);
    await customerAgent.get('/api/stores/me').expect(403);

    // Browsing the public marketplace is allowed.
    await customerAgent.get('/api/products').expect(200);
  });

  it('rejects unauthenticated seller requests', async () => {
    await request(app).get('/api/stores/me').expect(401);
    await request(app).get('/api/seller/products').expect(401);
    await request(app).post('/api/seller/products').send(riceInput).expect(401);
  });

  it('lets seller A create and update a store profile', async () => {
    const invalid = await sellerAAgent
      .post('/api/stores')
      .send({ name: 'x', city: 'Pune' })
      .expect(400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

    const created = await sellerAAgent
      .post('/api/stores')
      .send({
        name: 'Phase Four Fresh Mart',
        description: 'A neighbourhood store for pantry staples.',
        city: 'Pune',
      })
      .expect(201);

    assert.equal(created.body.store.name, 'Phase Four Fresh Mart');
    assert.equal(created.body.store.status, 'active');
    assert.match(created.body.store.slug, /^phase-four-fresh-mart/);
    storeAId = created.body.store.id;

    const duplicate = await sellerAAgent
      .post('/api/stores')
      .send({ name: 'Another Store', city: 'Pune' })
      .expect(409);
    assert.equal(duplicate.body.error.code, 'STORE_EXISTS');

    const updated = await sellerAAgent
      .patch('/api/stores/me')
      .send({ city: 'Mumbai', description: 'Updated store description.' })
      .expect(200);
    assert.equal(updated.body.store.city, 'Mumbai');
    assert.equal(updated.body.store.description, 'Updated store description.');

    const fetched = await sellerAAgent.get('/api/stores/me').expect(200);
    assert.equal(fetched.body.store.id, storeAId);
    assert.equal(fetched.body.store.city, 'Mumbai');
  });

  it('lets seller B create a separate store', async () => {
    const created = await sellerBAgent
      .post('/api/stores')
      .send({
        name: 'Phase Four Orchard',
        description: 'Fruit and vegetables from local farms.',
        city: 'Nashik',
      })
      .expect(201);

    storeBId = created.body.store.id;
    assert.notEqual(storeBId, storeAId);
    assert.equal(created.body.store.city, 'Nashik');
  });

  it('validates product fields and ignores injected ownership fields', async () => {
    const invalidBodies = [
      { ...riceInput, name: 'x' },
      { ...riceInput, description: 'tiny' },
      { ...riceInput, categoryId: 'not-a-category' },
      { ...riceInput, pricePaise: 0 },
      { ...riceInput, pricePaise: 123.45 },
      { ...riceInput, stock: -1 },
      { ...riceInput, stock: 1.5 },
      { ...riceInput, imageUrl: 'not-a-url' },
      { ...riceInput, imageUrl: 'ftp://example.com/image.jpg' },
      { ...riceInput, lowStockThreshold: -1 },
    ];

    for (const body of invalidBodies) {
      const response = await sellerAAgent
        .post('/api/seller/products')
        .send(body)
        .expect(400);
      assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    }

    // Ownership comes from the session. A client-supplied sellerId/storeId is
    // stripped and the product is attached to seller A's own store.
    const injected = await sellerAAgent
      .post('/api/seller/products')
      .send({ ...riceInput, sellerId: sellerBId, storeId: storeBId })
      .expect(201);
    assert.equal(injected.body.product.store.id, storeAId);
    await sellerAAgent
      .delete(`/api/seller/products/${injected.body.product.id}`)
      .expect(200);
  });

  it('creates products with ObjectId seller/store references and timestamps', async () => {
    const rice = await sellerAAgent
      .post('/api/seller/products')
      .send(riceInput)
      .expect(201);
    riceId = rice.body.product.id;
    assert.equal(rice.body.product.pricePaise, 49900);
    assert.equal(rice.body.product.inStock, true);
    assert.equal(rice.body.product.store.id, storeAId);

    const earbuds = await sellerAAgent
      .post('/api/seller/products')
      .send(earbudsInput)
      .expect(201);
    earbudsId = earbuds.body.product.id;
    assert.equal(earbuds.body.product.inStock, false);

    const notebook = await sellerAAgent
      .post('/api/seller/products')
      .send(notebookInput)
      .expect(201);
    notebookId = notebook.body.product.id;

    const apples = await sellerBAgent
      .post('/api/seller/products')
      .send(applesInput)
      .expect(201);

    const storedRice = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(riceId) });
    assert.ok(storedRice);
    assert.equal(storedRice.sellerId.toString(), sellerAId);
    assert.equal(storedRice.storeId.toString(), storeAId);
    assert.equal(storedRice.pricePaise, 49900);
    assert.ok(storedRice.createdAt instanceof Date);
    assert.ok(storedRice.updatedAt instanceof Date);

    const storedApples = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(apples.body.product.id) });
    assert.ok(storedApples);
    assert.equal(storedApples.sellerId.toString(), sellerBId);
    assert.equal(storedApples.storeId.toString(), storeBId);
  });

  it('lists real products publicly with store names', async () => {
    const response = await request(app)
      .get('/api/products?limit=60')
      .expect(200);

    assert.equal(response.body.total, 4);
    const rice = response.body.items.find(
      (item: { id: string }) => item.id === riceId,
    );
    assert.ok(rice);
    assert.equal(rice.store.name, 'Phase Four Fresh Mart');
    assert.equal(rice.store.city, 'Mumbai');
    assert.equal(rice.category, 'Groceries');
    assert.equal(rice.sellerId, undefined);
    assert.equal(rice.store.ownerId, undefined);
  });

  it('searches by name and escapes regular-expression input', async () => {
    const lower = await request(app).get('/api/products?q=rice').expect(200);
    assert.equal(lower.body.total, 1);
    assert.equal(lower.body.items[0].id, riceId);

    const upper = await request(app).get('/api/products?q=RICE').expect(200);
    assert.equal(upper.body.total, 1);

    const wildcard = await request(app).get('/api/products?q=.*').expect(200);
    assert.equal(wildcard.body.total, 0);
  });

  it('filters by category, price range and availability', async () => {
    const groceries = await request(app)
      .get('/api/products?category=groceries&limit=60')
      .expect(200);
    assert.equal(groceries.body.total, 2);
    assert.ok(
      groceries.body.items.every(
        (item: { categoryId: string }) => item.categoryId === 'groceries',
      ),
    );

    const priced = await request(app)
      .get('/api/products?minPricePaise=10000&maxPricePaise=20000&limit=60')
      .expect(200);
    assert.equal(priced.body.total, 2);
    assert.ok(
      priced.body.items.every(
        (item: { pricePaise: number }) =>
          item.pricePaise >= 10000 && item.pricePaise <= 20000,
      ),
    );

    const inStock = await request(app)
      .get('/api/products?availability=in_stock&limit=60')
      .expect(200);
    assert.equal(inStock.body.total, 3);
    assert.ok(
      inStock.body.items.every((item: { stock: number }) => item.stock > 0),
    );

    const outOfStock = await request(app)
      .get('/api/products?availability=out_of_stock&limit=60')
      .expect(200);
    assert.equal(outOfStock.body.total, 1);
    assert.equal(outOfStock.body.items[0].id, earbudsId);

    const combined = await request(app)
      .get('/api/products?category=groceries&availability=in_stock&limit=60')
      .expect(200);
    assert.equal(combined.body.total, 2);

    const invalidRange = await request(app)
      .get('/api/products?minPricePaise=5000&maxPricePaise=1000')
      .expect(400);
    assert.equal(invalidRange.body.error.code, 'VALIDATION_ERROR');

    await request(app).get('/api/products?category=invalid').expect(400);
    await request(app).get('/api/products?page=0').expect(400);
  });

  it('paginates public products', async () => {
    const first = await request(app)
      .get('/api/products?page=1&limit=2')
      .expect(200);
    assert.equal(first.body.items.length, 2);
    assert.equal(first.body.page, 1);
    assert.equal(first.body.pageSize, 2);
    assert.equal(first.body.total, 4);
    assert.equal(first.body.totalPages, 2);

    const second = await request(app)
      .get('/api/products?page=2&limit=2')
      .expect(200);
    assert.equal(second.body.items.length, 2);
    assert.notEqual(first.body.items[0].id, second.body.items[0].id);
  });

  it('returns product details and handles invalid ObjectIds', async () => {
    const detail = await request(app)
      .get(`/api/products/${riceId}`)
      .expect(200);
    assert.equal(detail.body.product.name, riceInput.name);
    assert.equal(detail.body.product.store.name, 'Phase Four Fresh Mart');

    const invalid = await request(app)
      .get('/api/products/not-an-object-id')
      .expect(400);
    assert.equal(invalid.body.error.code, 'INVALID_ID');

    const missing = await request(app)
      .get('/api/products/64b000000000000000000000')
      .expect(404);
    assert.equal(missing.body.error.code, 'PRODUCT_NOT_FOUND');
  });

  it('lets a seller update their own product and stock', async () => {
    const beforeUpdate = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(riceId) });
    assert.ok(beforeUpdate);

    const updated = await sellerAAgent
      .patch(`/api/seller/products/${riceId}`)
      .send({ pricePaise: 45000, stock: 4, lowStockThreshold: 5 })
      .expect(200);

    assert.equal(updated.body.product.pricePaise, 45000);
    assert.equal(updated.body.product.stock, 4);

    const stored = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(riceId) });
    assert.ok(stored);
    assert.equal(stored.pricePaise, 45000);
    assert.equal(stored.stock, 4);
    assert.ok(
      new Date(stored.updatedAt).getTime() >=
        new Date(beforeUpdate.updatedAt).getTime(),
    );

    const detail = await request(app)
      .get(`/api/products/${riceId}`)
      .expect(200);
    assert.equal(detail.body.product.pricePaise, 45000);
  });

  it('returns seller products with a low-stock summary', async () => {
    const sellerA = await sellerAAgent.get('/api/seller/products').expect(200);
    assert.equal(sellerA.body.summary.total, 3);
    assert.equal(sellerA.body.summary.outOfStock, 1);
    assert.equal(sellerA.body.summary.lowStock, 3);
    assert.ok(
      sellerA.body.items.every(
        (item: { store: { id: string } }) => item.store.id === storeAId,
      ),
    );

    const sellerB = await sellerBAgent.get('/api/seller/products').expect(200);
    assert.equal(sellerB.body.summary.total, 1);
    assert.ok(
      sellerB.body.items.every(
        (item: { id: string }) => item.id !== riceId,
      ),
    );
  });

  it('prevents seller B from changing or deleting seller A products', async () => {
    const attemptedUpdate = await sellerBAgent
      .patch(`/api/seller/products/${riceId}`)
      .send({ name: 'Hijacked product', pricePaise: 100 })
      .expect(404);
    assert.equal(attemptedUpdate.body.error.code, 'PRODUCT_NOT_FOUND');

    const attemptedDelete = await sellerBAgent
      .delete(`/api/seller/products/${riceId}`)
      .expect(404);
    assert.equal(attemptedDelete.body.error.code, 'PRODUCT_NOT_FOUND');

    const stored = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(riceId) });
    assert.ok(stored);
    assert.equal(stored.name, riceInput.name);
    assert.equal(stored.pricePaise, 45000);

    // Seller B can still browse the public listing, which does not expose
    // ownership controls.
    await sellerBAgent.get(`/api/products/${riceId}`).expect(200);
  });

  it('hides inactive products from shoppers but not from their seller', async () => {
    await sellerAAgent
      .patch(`/api/seller/products/${earbudsId}`)
      .send({ isActive: false })
      .expect(200);

    const publicList = await request(app)
      .get('/api/products?q=earbuds&limit=60')
      .expect(200);
    assert.equal(publicList.body.total, 0);

    const sellerList = await sellerAAgent.get('/api/seller/products').expect(200);
    const earbuds = sellerList.body.items.find(
      (item: { id: string }) => item.id === earbudsId,
    );
    assert.ok(earbuds);
    assert.equal(earbuds.isActive, false);

    await sellerAAgent
      .patch(`/api/seller/products/${earbudsId}`)
      .send({ isActive: true })
      .expect(200);
  });

  it('handles invalid ids and empty updates on seller routes', async () => {
    await sellerAAgent
      .patch('/api/seller/products/not-an-id')
      .send({ stock: 2 })
      .expect(400);
    await sellerAAgent.delete('/api/seller/products/not-an-id').expect(400);
    await sellerAAgent
      .patch(`/api/seller/products/${riceId}`)
      .send({})
      .expect(400);
    await sellerAAgent
      .patch(`/api/seller/products/${riceId}`)
      .send({ sellerId: sellerBId })
      .expect(400);
  });

  it('lets a seller delete only their own product', async () => {
    const deleted = await sellerAAgent
      .delete(`/api/seller/products/${notebookId}`)
      .expect(200);
    assert.equal(deleted.body.success, true);
    assert.equal(deleted.body.id, notebookId);

    const stored = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(notebookId) });
    assert.equal(stored, null);

    const secondDelete = await sellerAAgent
      .delete(`/api/seller/products/${notebookId}`)
      .expect(404);
    assert.equal(secondDelete.body.error.code, 'PRODUCT_NOT_FOUND');

    const publicSearch = await request(app)
      .get('/api/products?q=notebook')
      .expect(200);
    assert.equal(publicSearch.body.total, 0);

    const sellerList = await sellerAAgent.get('/api/seller/products').expect(200);
    assert.equal(sellerList.body.summary.total, 2);
  });
});

describe('cart, checkout and orders', () => {
  let sellerAgent: ReturnType<typeof request.agent>;
  let otherSellerAgent: ReturnType<typeof request.agent>;
  let customerAgent: ReturnType<typeof request.agent>;
  let customerTwoAgent: ReturnType<typeof request.agent>;
  let sellerId = '';
  let otherSellerId = '';
  let storeId = '';
  let otherStoreId = '';
  let mainProductId = '';
  let lowStockProductId = '';
  let cancelProductId = '';
  let singleStockProductId = '';
  let otherStoreProductId = '';
  let successOrderId = '';
  let successOrderNumber = '';
  let cancelledOrderId = '';
  let customerId = '';

  const address = {
    fullName: 'Phase Five Customer',
    phone: '+919876543210',
    line1: '42 Market Road',
    line2: 'Near the old clock tower',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    country: 'India',
  };

  const productInput = (
    name: string,
    pricePaise: number,
    stock: number,
  ) => ({
    name,
    description: `${name} used for the Phase Five integration test flow.`,
    categoryId: 'groceries',
    pricePaise,
    stock,
    imageUrl: `https://images.example.com/products/${name
      .toLowerCase()
      .replaceAll(' ', '-')}.jpg`,
    lowStockThreshold: 2,
  });

  before(async () => {
    sellerAgent = request.agent(app);
    const seller = await sellerAgent
      .post('/api/auth/register/seller')
      .send({
        fullName: 'Phase Five Seller',
        email: 'phase5.seller@nearkart.test',
        password: 'SellerPass123!',
      })
      .expect(201);
    sellerId = seller.body.user.id;

    const store = await sellerAgent
      .post('/api/stores')
      .send({
        name: 'Phase Five Market',
        description: 'A store used to test cart and order fulfilment.',
        city: 'Pune',
      })
      .expect(201);
    storeId = store.body.store.id;

    otherSellerAgent = request.agent(app);
    const otherSeller = await otherSellerAgent
      .post('/api/auth/register/seller')
      .send({
        fullName: 'Phase Five Other Seller',
        email: 'phase5.other.seller@nearkart.test',
        password: 'SellerPass123!',
      })
      .expect(201);
    otherSellerId = otherSeller.body.user.id;

    const otherStore = await otherSellerAgent
      .post('/api/stores')
      .send({
        name: 'Phase Five Other Store',
        description: 'A separate store for cross-store cart checks.',
        city: 'Mumbai',
      })
      .expect(201);
    otherStoreId = otherStore.body.store.id;

    const mainProduct = await sellerAgent
      .post('/api/seller/products')
      .send(productInput('Cart Test Rice', 50000, 10))
      .expect(201);
    mainProductId = mainProduct.body.product.id;

    const lowStockProduct = await sellerAgent
      .post('/api/seller/products')
      .send(productInput('Low Stock Lentils', 10000, 3))
      .expect(201);
    lowStockProductId = lowStockProduct.body.product.id;

    const cancelProduct = await sellerAgent
      .post('/api/seller/products')
      .send(productInput('Cancel Test Tea', 20000, 5))
      .expect(201);
    cancelProductId = cancelProduct.body.product.id;

    const singleStockProduct = await sellerAgent
      .post('/api/seller/products')
      .send(productInput('Single Stock Soap', 15000, 1))
      .expect(201);
    singleStockProductId = singleStockProduct.body.product.id;

    const otherProduct = await otherSellerAgent
      .post('/api/seller/products')
      .send(productInput('Other Store Apples', 30000, 5))
      .expect(201);
    otherStoreProductId = otherProduct.body.product.id;

    customerAgent = request.agent(app);
    const customer = await customerAgent
      .post('/api/auth/register/customer')
      .send({
        fullName: 'Phase Five Customer',
        email: 'phase5.customer@nearkart.test',
        password: 'CustomerPass123!',
      })
      .expect(201);
    customerId = customer.body.user.id;

    customerTwoAgent = request.agent(app);
    await customerTwoAgent
      .post('/api/auth/register/customer')
      .send({
        fullName: 'Phase Five Customer Two',
        email: 'phase5.customer.two@nearkart.test',
        password: 'CustomerPass123!',
      })
      .expect(201);
  });

  it('requires a customer session for cart and order routes', async () => {
    await request(app).get('/api/cart').expect(401);
    await request(app).post('/api/cart/items').send({}).expect(401);
    await request(app).get('/api/orders').expect(401);
    await request(app).get('/api/seller/orders').expect(401);

    await sellerAgent.get('/api/cart').expect(403);
    await sellerAgent.get('/api/orders').expect(403);
    await customerAgent.get('/api/seller/orders').expect(403);
  });

  it('adds, updates and validates one-store cart items', async () => {
    const empty = await customerAgent.get('/api/cart').expect(200);
    assert.equal(empty.body.cart.itemCount, 0);
    assert.equal(empty.body.cart.hasIssues, false);

    const first = await customerAgent
      .post('/api/cart/items')
      .send({ productId: mainProductId, quantity: 2 })
      .expect(200);
    assert.equal(first.body.cart.itemCount, 2);
    assert.equal(first.body.cart.subtotalPaise, 100000);
    assert.equal(first.body.cart.store.id, storeId);
    assert.equal(first.body.cart.items[0].isAvailable, true);

    const incremented = await customerAgent
      .post('/api/cart/items')
      .send({ productId: mainProductId, quantity: 1 })
      .expect(200);
    assert.equal(incremented.body.cart.items[0].quantity, 3);

    const updated = await customerAgent
      .patch(`/api/cart/items/${mainProductId}`)
      .send({ quantity: 4 })
      .expect(200);
    assert.equal(updated.body.cart.items[0].quantity, 4);
    assert.equal(updated.body.cart.subtotalPaise, 200000);

    const tooMany = await customerAgent
      .patch(`/api/cart/items/${mainProductId}`)
      .send({ quantity: 11 })
      .expect(409);
    assert.equal(tooMany.body.error.code, 'INSUFFICIENT_STOCK');

    const resetQuantity = await customerAgent
      .patch(`/api/cart/items/${mainProductId}`)
      .send({ quantity: 2 })
      .expect(200);
    assert.equal(resetQuantity.body.cart.items[0].quantity, 2);

    const conflict = await customerAgent
      .post('/api/cart/items')
      .send({ productId: otherStoreProductId, quantity: 1 })
      .expect(409);
    assert.equal(conflict.body.error.code, 'CART_STORE_CONFLICT');
    assert.match(conflict.body.error.message, /Phase Five Market/);
    assert.match(conflict.body.error.message, /Phase Five Other Store/);

    const invalidId = await customerAgent
      .post('/api/cart/items')
      .send({ productId: 'not-an-id', quantity: 1 })
      .expect(400);
    assert.equal(invalidId.body.error.code, 'VALIDATION_ERROR');

    const missingProduct = await customerAgent
      .post('/api/cart/items')
      .send({ productId: '64b000000000000000000000', quantity: 1 })
      .expect(404);
    assert.equal(missingProduct.body.error.code, 'PRODUCT_NOT_FOUND');

    const tooLargeQuantity = await customerAgent
      .post('/api/cart/items')
      .send({ productId: singleStockProductId, quantity: 2 })
      .expect(409);
    assert.equal(tooLargeQuantity.body.error.code, 'INSUFFICIENT_STOCK');
  });

  it('keeps carts separate per customer and survives login/logout', async () => {
    const customerTwoCart = await customerTwoAgent.get('/api/cart').expect(200);
    assert.equal(customerTwoCart.body.cart.itemCount, 0);

    await customerAgent.post('/api/auth/logout').expect(200);
    await customerAgent.get('/api/cart').expect(401);

    await customerAgent
      .post('/api/auth/login')
      .send({
        email: 'phase5.customer@nearkart.test',
        password: 'CustomerPass123!',
      })
      .expect(200);

    const restored = await customerAgent.get('/api/cart').expect(200);
    assert.equal(restored.body.cart.itemCount, 2);
    assert.equal(restored.body.cart.items[0].productId, mainProductId);
  });

  it('creates an order from the server cart and prevents duplicate orders', async () => {
    const checkoutBody = {
      idempotencyKey: 'phase5-success-order-001',
      deliveryAddress: address,
    };

    const placed = await customerAgent
      .post('/api/orders')
      .send(checkoutBody)
      .expect(201);

    successOrderId = placed.body.order.id;
    successOrderNumber = placed.body.order.orderNumber;
    assert.match(successOrderNumber, /^NK-\d{8}-[0-9A-F]{6}$/);
    assert.equal(placed.body.order.status, 'pending');
    assert.equal(placed.body.order.subtotalPaise, 100000);
    assert.equal(placed.body.order.deliveryFeePaise, 0);
    assert.equal(
      placed.body.order.deliveryFeeStatus,
      'pending_maps_integration',
    );
    assert.equal(placed.body.order.totalPaise, 100000);
    assert.equal(placed.body.order.items[0].pricePaise, 50000);
    assert.equal(placed.body.order.items[0].quantity, 2);
    assert.equal(placed.body.order.deliveryAddress.line1, address.line1);

    const productAfter = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(mainProductId) });
    assert.ok(productAfter);
    assert.equal(productAfter.stock, 8);

    const storedOrder = await getDb()
      .collection('orders')
      .findOne({ _id: new ObjectId(successOrderId) });
    assert.ok(storedOrder);
    assert.equal(storedOrder.customerId.toString(), customerId);
    assert.equal(storedOrder.storeId.toString(), storeId);
    assert.equal(storedOrder.sellerId.toString(), sellerId);
    assert.ok(storedOrder.customerId instanceof ObjectId);
    assert.ok(storedOrder.storeId instanceof ObjectId);
    assert.equal(storedOrder.items[0].productId.toString(), mainProductId);
    assert.equal(storedOrder.items[0].pricePaise, 50000);
    assert.equal(storedOrder.stockAdjusted, true);
    assert.ok(storedOrder.placedAt instanceof Date);
    assert.ok(Array.isArray(storedOrder.statusHistory));

    const emptyCart = await customerAgent.get('/api/cart').expect(200);
    assert.equal(emptyCart.body.cart.itemCount, 0);

    const duplicate = await customerAgent
      .post('/api/orders')
      .send(checkoutBody)
      .expect(201);
    assert.equal(duplicate.body.order.id, successOrderId);

    const productStill = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(mainProductId) });
    assert.ok(productStill);
    assert.equal(productStill.stock, 8);
    assert.equal(
      await getDb()
        .collection('orders')
        .countDocuments({ idempotencyKey: checkoutBody.idempotencyKey }),
      1,
    );

    const list = await customerAgent.get('/api/orders').expect(200);
    assert.equal(list.body.total, 1);
    assert.equal(list.body.items[0].id, successOrderId);

    const detail = await customerAgent
      .get(`/api/orders/${successOrderId}`)
      .expect(200);
    assert.equal(detail.body.order.orderNumber, successOrderNumber);

    // The order keeps the purchase-time price if the seller edits the listing.
    await sellerAgent
      .patch(`/api/seller/products/${mainProductId}`)
      .send({ pricePaise: 60000 })
      .expect(200);

    const afterPriceChange = await customerAgent
      .get(`/api/orders/${successOrderId}`)
      .expect(200);
    assert.equal(afterPriceChange.body.order.items[0].pricePaise, 50000);

    await sellerAgent
      .patch(`/api/seller/products/${mainProductId}`)
      .send({ pricePaise: 50000 })
      .expect(200);
  });

  it('rejects checkout when stock changed and leaves inventory untouched', async () => {
    await customerAgent
      .post('/api/cart/items')
      .send({ productId: lowStockProductId, quantity: 2 })
      .expect(200);

    await sellerAgent
      .patch(`/api/seller/products/${lowStockProductId}`)
      .send({ stock: 1 })
      .expect(200);

    const response = await customerAgent
      .post('/api/orders')
      .send({
        idempotencyKey: 'phase5-insufficient-stock-001',
        deliveryAddress: address,
      })
      .expect(409);
    assert.equal(response.body.error.code, 'INSUFFICIENT_STOCK');

    const product = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(lowStockProductId) });
    assert.ok(product);
    assert.equal(product.stock, 1);

    assert.equal(
      await getDb()
        .collection('orders')
        .countDocuments({
          idempotencyKey: 'phase5-insufficient-stock-001',
        }),
      0,
    );

    // The cart is still present so the customer can fix the quantity.
    const cart = await customerAgent.get('/api/cart').expect(200);
    assert.equal(cart.body.cart.items[0].isAvailable, false);
    assert.match(cart.body.cart.items[0].issue, /Only 1 left/);

    await sellerAgent
      .patch(`/api/seller/products/${lowStockProductId}`)
      .send({ stock: 3 })
      .expect(200);
    await customerAgent.delete('/api/cart').expect(200);
  });

  it('prevents two concurrent customers from overselling one item', async () => {
    await customerAgent.delete('/api/cart').expect(200);
    await customerTwoAgent.delete('/api/cart').expect(200);

    await customerAgent
      .post('/api/cart/items')
      .send({ productId: singleStockProductId, quantity: 1 })
      .expect(200);
    await customerTwoAgent
      .post('/api/cart/items')
      .send({ productId: singleStockProductId, quantity: 1 })
      .expect(200);

    const [first, second] = await Promise.all([
      customerAgent.post('/api/orders').send({
        idempotencyKey: 'phase5-race-order-a',
        deliveryAddress: address,
      }),
      customerTwoAgent.post('/api/orders').send({
        idempotencyKey: 'phase5-race-order-b',
        deliveryAddress: {
          ...address,
          fullName: 'Phase Five Customer Two',
        },
      }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [201, 409]);
    const failure = first.status === 409 ? first : second;
    assert.equal(failure.body.error.code, 'INSUFFICIENT_STOCK');

    const product = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(singleStockProductId) });
    assert.ok(product);
    assert.equal(product.stock, 0);
    assert.equal(
      await getDb()
        .collection('orders')
        .countDocuments({ 'items.productId': new ObjectId(singleStockProductId) }),
      1,
    );

    await customerAgent.delete('/api/cart').expect(200);
    await customerTwoAgent.delete('/api/cart').expect(200);
  });

  it('blocks cross-customer order access and invalid checkout input', async () => {
    const otherCustomerResponse = await customerTwoAgent
      .get(`/api/orders/${successOrderId}`)
      .expect(404);
    assert.equal(otherCustomerResponse.body.error.code, 'ORDER_NOT_FOUND');

    const invalidId = await customerAgent
      .get('/api/orders/not-an-order-id')
      .expect(400);
    assert.equal(invalidId.body.error.code, 'INVALID_ID');

    const invalidCheckout = await customerAgent
      .post('/api/orders')
      .send({
        idempotencyKey: 'phase5-invalid-address-001',
        deliveryAddress: {
          fullName: 'A',
          phone: 'x',
          line1: '',
          city: '',
          state: '',
          postalCode: 'abc',
        },
      })
      .expect(400);
    assert.equal(invalidCheckout.body.error.code, 'VALIDATION_ERROR');

    // A customer cannot use the seller-only status endpoint.
    await customerAgent
      .patch(`/api/seller/orders/${successOrderId}/status`)
      .send({ status: 'confirmed' })
      .expect(403);
  });

  it('shows each seller only their own orders and validates status transitions', async () => {
    const sellerOrders = await sellerAgent
      .get('/api/seller/orders?limit=50')
      .expect(200);
    assert.ok(sellerOrders.body.total >= 2);
    assert.ok(
      sellerOrders.body.items.every(
        (order: { store: { id: string } }) => order.store.id === storeId,
      ),
    );

    const target = sellerOrders.body.items.find(
      (order: { id: string }) => order.id === successOrderId,
    );
    assert.ok(target);
    assert.equal(target.customer.fullName, address.fullName);
    assert.equal(target.customer.phone, address.phone);
    assert.equal(target.customer.city, address.city);
    assert.equal(target.customer.line1, undefined);
    assert.equal(target.customer.postalCode, address.postalCode);

    const otherSellerOrders = await otherSellerAgent
      .get('/api/seller/orders?limit=50')
      .expect(200);
    assert.equal(otherSellerOrders.body.total, 0);

    await otherSellerAgent
      .get(`/api/seller/orders/${successOrderId}`)
      .expect(404);

    const invalidTransition = await sellerAgent
      .patch(`/api/seller/orders/${successOrderId}/status`)
      .send({ status: 'delivered' })
      .expect(409);
    assert.equal(invalidTransition.body.error.code, 'INVALID_STATUS_TRANSITION');

    const confirmed = await sellerAgent
      .patch(`/api/seller/orders/${successOrderId}/status`)
      .send({ status: 'confirmed', note: 'Order accepted' })
      .expect(200);
    assert.equal(confirmed.body.order.status, 'confirmed');

    const preparing = await sellerAgent
      .patch(`/api/seller/orders/${successOrderId}/status`)
      .send({ status: 'preparing' })
      .expect(200);
    assert.equal(preparing.body.order.status, 'preparing');

    const ready = await sellerAgent
      .patch(`/api/seller/orders/${successOrderId}/status`)
      .send({ status: 'ready_for_pickup' })
      .expect(200);
    assert.equal(ready.body.order.status, 'ready_for_pickup');

    const delivered = await sellerAgent
      .patch(`/api/seller/orders/${successOrderId}/status`)
      .send({ status: 'delivered' })
      .expect(200);
    assert.equal(delivered.body.order.status, 'delivered');
    assert.deepEqual(
      delivered.body.order.statusHistory.map(
        (entry: { status: string }) => entry.status,
      ),
      [
        'pending',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'delivered',
      ],
    );
    assert.equal(delivered.body.order.statusHistory[1].note, 'Order accepted');

    const customerView = await customerAgent
      .get(`/api/orders/${successOrderId}`)
      .expect(200);
    assert.equal(customerView.body.order.status, 'delivered');

    const cancelledDelivery = await sellerAgent
      .patch(`/api/seller/orders/${successOrderId}/status`)
      .send({ status: 'cancelled' })
      .expect(409);
    assert.equal(
      cancelledDelivery.body.error.code,
      'INVALID_STATUS_TRANSITION',
    );
  });

  it('restores stock when a seller cancels an order', async () => {
    await customerAgent
      .post('/api/cart/items')
      .send({ productId: cancelProductId, quantity: 2 })
      .expect(200);

    const placed = await customerAgent
      .post('/api/orders')
      .send({
        idempotencyKey: 'phase5-cancel-order-001',
        deliveryAddress: address,
      })
      .expect(201);
    cancelledOrderId = placed.body.order.id;

    const afterOrder = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(cancelProductId) });
    assert.ok(afterOrder);
    assert.equal(afterOrder.stock, 3);

    const cancelled = await sellerAgent
      .patch(`/api/seller/orders/${cancelledOrderId}/status`)
      .send({ status: 'cancelled', note: 'Customer requested cancellation' })
      .expect(200);
    assert.equal(cancelled.body.order.status, 'cancelled');
    assert.equal(cancelled.body.order.stockRestored, true);
    assert.equal(
      cancelled.body.order.cancellationReason,
      'Customer requested cancellation',
    );

    const restored = await getDb()
      .collection('products')
      .findOne({ _id: new ObjectId(cancelProductId) });
    assert.ok(restored);
    assert.equal(restored.stock, 5);

    const secondCancel = await sellerAgent
      .patch(`/api/seller/orders/${cancelledOrderId}/status`)
      .send({ status: 'cancelled' })
      .expect(409);
    assert.equal(secondCancel.body.error.code, 'INVALID_STATUS_TRANSITION');
  });

  it('rejects checkout when a cart product becomes unavailable', async () => {
    await customerAgent
      .post('/api/cart/items')
      .send({ productId: lowStockProductId, quantity: 1 })
      .expect(200);

    await sellerAgent
      .patch(`/api/seller/products/${lowStockProductId}`)
      .send({ isActive: false })
      .expect(200);

    const cart = await customerAgent.get('/api/cart').expect(200);
    assert.equal(cart.body.cart.hasIssues, true);

    const response = await customerAgent
      .post('/api/orders')
      .send({
        idempotencyKey: 'phase5-unavailable-product-001',
        deliveryAddress: address,
      })
      .expect(409);
    assert.equal(response.body.error.code, 'PRODUCT_UNAVAILABLE');

    assert.equal(
      await getDb()
        .collection('orders')
        .countDocuments({
          idempotencyKey: 'phase5-unavailable-product-001',
        }),
      0,
    );

    await sellerAgent
      .patch(`/api/seller/products/${lowStockProductId}`)
      .send({ isActive: true })
      .expect(200);
    await customerAgent.delete('/api/cart').expect(200);
  });

  it('keeps carts isolated and supports removing items', async () => {
    await customerTwoAgent.delete('/api/cart').expect(200);

    const first = await customerAgent
      .post('/api/cart/items')
      .send({ productId: mainProductId, quantity: 1 })
      .expect(200);
    assert.equal(first.body.cart.itemCount, 1);

    const second = await customerTwoAgent
      .post('/api/cart/items')
      .send({ productId: mainProductId, quantity: 2 })
      .expect(200);
    assert.equal(second.body.cart.itemCount, 2);

    const firstCart = await customerAgent.get('/api/cart').expect(200);
    const secondCart = await customerTwoAgent.get('/api/cart').expect(200);
    assert.equal(firstCart.body.cart.itemCount, 1);
    assert.equal(secondCart.body.cart.itemCount, 2);

    const removed = await customerAgent
      .delete(`/api/cart/items/${mainProductId}`)
      .expect(200);
    assert.equal(removed.body.cart.itemCount, 0);
    assert.equal(removed.body.cart.id, null);

    const secondStill = await customerTwoAgent.get('/api/cart').expect(200);
    assert.equal(secondStill.body.cart.itemCount, 2);

    const cleared = await customerTwoAgent.delete('/api/cart').expect(200);
    assert.equal(cleared.body.cart.itemCount, 0);
  });

  it('does not expose another seller or customer in order responses', async () => {
    const sellerOrder = await sellerAgent
      .get(`/api/seller/orders/${cancelledOrderId}`)
      .expect(200);
    assert.equal(sellerOrder.body.order.customer.fullName, address.fullName);
    assert.equal(sellerOrder.body.order.customer.line1, undefined);
    assert.equal(sellerOrder.body.order.deliveryAddress, undefined);

    const otherSellerView = await otherSellerAgent
      .get(`/api/seller/orders/${cancelledOrderId}`)
      .expect(404);
    assert.equal(otherSellerView.body.error.code, 'ORDER_NOT_FOUND');

    const otherCustomerList = await customerTwoAgent
      .get('/api/orders?limit=50')
      .expect(200);
    assert.ok(
      otherCustomerList.body.items.every(
        (order: { id: string }) => order.id !== cancelledOrderId,
      ),
    );
  });
});

describe('delivery quotes and map configuration', () => {
  const pricing = {
    baseFeePaise: 2000,
    perKmPaise: 800,
    perMinutePaise: 0,
    minimumFeePaise: 2000,
    maxDistanceMeters: 25_000,
  };

  const storeWithLocation = {
    location: { latitude: 18.5204, longitude: 73.8567 },
  };

  const address = {
    fullName: 'Phase Six Customer',
    phone: '+919876543210',
    line1: '12 Station Road',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    country: 'India',
  };

  function mockFetch(
    body: unknown,
    status = 200,
  ): { fetchImpl: typeof fetch; calls: Array<{ url: string; init?: RequestInit }> } {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      };
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
  }

  it('calculates integer-paise fees with rounding and a minimum', () => {
    assert.equal(calculateDeliveryFeePaise(0, 0, pricing), 2000);
    assert.equal(calculateDeliveryFeePaise(1001, 60, pricing), 3600);
    assert.equal(
      calculateDeliveryFeePaise(
        200,
        30,
        { ...pricing, baseFeePaise: 500, perKmPaise: 100, minimumFeePaise: 1000 },
      ),
      1000,
    );
    assert.equal(
      calculateDeliveryFeePaise(
        100,
        61,
        {
          ...pricing,
          baseFeePaise: 0,
          perKmPaise: 0,
          perMinutePaise: 50,
          minimumFeePaise: 0,
        },
      ),
      100,
    );
    // Invalid negative inputs never reduce the fee below the minimum.
    assert.equal(calculateDeliveryFeePaise(-100, -100, pricing), 2000);
  });

  it('marks only address/route failures as blocking checkout', () => {
    assert.equal(isDeliveryQuoteBlocking('MAPS_NOT_CONFIGURED'), false);
    assert.equal(isDeliveryQuoteBlocking('STORE_LOCATION_MISSING'), false);
    assert.equal(isDeliveryQuoteBlocking('ADDRESS_INVALID'), true);
    assert.equal(isDeliveryQuoteBlocking('ROUTE_NOT_FOUND'), true);
    assert.equal(isDeliveryQuoteBlocking('ROUTE_UNAVAILABLE'), true);
    assert.equal(isDeliveryQuoteBlocking('ROUTE_TOO_LONG'), true);
  });

  it('uses the Routes API distance, duration and destination coordinates', async () => {
    const mock = mockFetch({
      routes: [
        {
          distanceMeters: 4200,
          duration: '900s',
          polyline: { encodedPolyline: 'encoded-route' },
          legs: [
            {
              startLocation: {
                latLng: { latitude: 18.5204, longitude: 73.8567 },
              },
              endLocation: {
                latLng: { latitude: 18.531, longitude: 73.844 },
              },
            },
          ],
        },
      ],
    });

    const quote = await quoteDeliveryForStore(
      storeWithLocation,
      address,
      10_000,
      {
        apiKey: 'server-routes-key',
        pricing,
        fetchImpl: mock.fetchImpl,
        now: () => new Date('2026-10-23T10:00:00.000Z'),
      },
    );

    assert.equal(quote.status, 'calculated');
    assert.equal(quote.subtotalPaise, 10_000);
    // 4.2 km rounds up to 5 km: 2000 + 5 × 800.
    assert.equal(quote.deliveryFeePaise, 6000);
    assert.equal(quote.totalPaise, 16_000);

    if (quote.status !== 'calculated') {
      return;
    }

    assert.equal(quote.route.distanceMeters, 4200);
    assert.equal(quote.route.durationSeconds, 900);
    assert.equal(quote.route.polyline, 'encoded-route');
    assert.deepEqual(quote.route.origin, {
      latitude: 18.5204,
      longitude: 73.8567,
    });
    assert.deepEqual(quote.route.destination, {
      latitude: 18.531,
      longitude: 73.844,
    });
    assert.equal(quote.route.provider, 'google_routes');
    assert.equal(quote.route.quotedAt.toISOString(), '2026-10-23T10:00:00.000Z');

    assert.equal(mock.calls.length, 1);
    const [call] = mock.calls;
    assert.equal(
      call.url,
      'https://routes.googleapis.com/directions/v2:computeRoutes',
    );
    const headers = call.init?.headers as Record<string, string>;
    assert.equal(headers['X-Goog-Api-Key'], 'server-routes-key');
    assert.match(headers['X-Goog-FieldMask'], /routes\.distanceMeters/);

    const body = JSON.parse(String(call.init?.body)) as {
      origin: { location: { latLng: { latitude: number } } };
      destination: { address: string };
      travelMode: string;
    };
    assert.equal(body.origin.location.latLng.latitude, 18.5204);
    assert.match(body.destination.address, /12 Station Road/);
    assert.match(body.destination.address, /Pune/);
    assert.equal(body.travelMode, 'DRIVE');
  });

  it('returns an explicit unavailable reason for each failure mode', async () => {
    const noKey = await quoteDeliveryForStore(storeWithLocation, address, 5000, {
      apiKey: '',
      pricing,
    });
    assert.equal(noKey.status, 'unavailable');
    if (noKey.status === 'unavailable') {
      assert.equal(noKey.reason, 'MAPS_NOT_CONFIGURED');
      assert.equal(noKey.checkoutAllowed, true);
      assert.equal(noKey.deliveryFeePaise, 0);
      assert.equal(noKey.totalPaise, 5000);
    }

    const noStoreLocation = await quoteDeliveryForStore({}, address, 5000, {
      apiKey: 'server-routes-key',
      pricing,
    });
    assert.equal(noStoreLocation.status, 'unavailable');
    if (noStoreLocation.status === 'unavailable') {
      assert.equal(noStoreLocation.reason, 'STORE_LOCATION_MISSING');
      assert.equal(noStoreLocation.checkoutAllowed, true);
    }

    const invalidAddress = await quoteDeliveryForStore(
      storeWithLocation,
      address,
      5000,
      {
        apiKey: 'server-routes-key',
        pricing,
        fetchImpl: mockFetch({}, 400).fetchImpl,
      },
    );
    assert.equal(invalidAddress.status, 'unavailable');
    if (invalidAddress.status === 'unavailable') {
      assert.equal(invalidAddress.reason, 'ADDRESS_INVALID');
      assert.equal(invalidAddress.checkoutAllowed, false);
    }

    const apiFailure = await quoteDeliveryForStore(
      storeWithLocation,
      address,
      5000,
      {
        apiKey: 'server-routes-key',
        pricing,
        fetchImpl: mockFetch({}, 500).fetchImpl,
      },
    );
    assert.equal(apiFailure.status, 'unavailable');
    if (apiFailure.status === 'unavailable') {
      assert.equal(apiFailure.reason, 'ROUTE_UNAVAILABLE');
      assert.equal(apiFailure.checkoutAllowed, false);
    }

    const noRoute = await quoteDeliveryForStore(storeWithLocation, address, 5000, {
      apiKey: 'server-routes-key',
      pricing,
      fetchImpl: mockFetch({ routes: [] }).fetchImpl,
    });
    assert.equal(noRoute.status, 'unavailable');
    if (noRoute.status === 'unavailable') {
      assert.equal(noRoute.reason, 'ROUTE_NOT_FOUND');
      assert.equal(noRoute.checkoutAllowed, false);
    }

    const tooLong = await quoteDeliveryForStore(storeWithLocation, address, 5000, {
      apiKey: 'server-routes-key',
      pricing,
      fetchImpl: mockFetch({
        routes: [
          {
            distanceMeters: 30_000,
            duration: '1800s',
            legs: [
              {
                endLocation: {
                  latLng: { latitude: 18.6, longitude: 73.9 },
                },
              },
            ],
          },
        ],
      }).fetchImpl,
    });
    assert.equal(tooLong.status, 'unavailable');
    if (tooLong.status === 'unavailable') {
      assert.equal(tooLong.reason, 'ROUTE_TOO_LONG');
      assert.equal(tooLong.checkoutAllowed, false);
    }
  });

  describe('HTTP endpoints', () => {
    let sellerAgent: ReturnType<typeof request.agent>;
    let customerAgent: ReturnType<typeof request.agent>;
    let emptyCustomerAgent: ReturnType<typeof request.agent>;
    let storeId = '';
    let productId = '';

    before(async () => {
      sellerAgent = request.agent(app);
      await sellerAgent
        .post('/api/auth/register/seller')
        .send({
          fullName: 'Phase Six Seller',
          email: 'phase6.seller@nearkart.test',
          password: 'SellerPass123!',
        })
        .expect(201);

      const store = await sellerAgent
        .post('/api/stores')
        .send({
          name: 'Phase Six Store',
          description: 'A store used for delivery quote checks.',
          city: 'Pune',
        })
        .expect(201);
      storeId = store.body.store.id;
      assert.equal(store.body.store.location, undefined);

      const product = await sellerAgent
        .post('/api/seller/products')
        .send({
          name: 'Quote Test Coffee',
          description: 'Coffee used for delivery quote checks.',
          categoryId: 'groceries',
          pricePaise: 25000,
          stock: 5,
          imageUrl: 'https://images.example.com/products/quote-coffee.jpg',
          lowStockThreshold: 1,
        })
        .expect(201);
      productId = product.body.product.id;

      customerAgent = request.agent(app);
      await customerAgent
        .post('/api/auth/register/customer')
        .send({
          fullName: 'Phase Six Customer',
          email: 'phase6.customer@nearkart.test',
          password: 'CustomerPass123!',
        })
        .expect(201);

      emptyCustomerAgent = request.agent(app);
      await emptyCustomerAgent
        .post('/api/auth/register/customer')
        .send({
          fullName: 'Phase Six Empty Customer',
          email: 'phase6.empty@nearkart.test',
          password: 'CustomerPass123!',
        })
        .expect(201);

      await customerAgent
        .post('/api/cart/items')
        .send({ productId, quantity: 2 })
        .expect(200);
    });

    it('protects the quote endpoint and requires a non-empty cart', async () => {
      await request(app)
        .post('/api/delivery/quote')
        .send({ deliveryAddress: address })
        .expect(401);

      await sellerAgent
        .post('/api/delivery/quote')
        .send({ deliveryAddress: address })
        .expect(403);

      const empty = await emptyCustomerAgent
        .post('/api/delivery/quote')
        .send({ deliveryAddress: address })
        .expect(409);
      assert.equal(empty.body.error.code, 'CART_EMPTY');

      const invalid = await customerAgent
        .post('/api/delivery/quote')
        .send({ deliveryAddress: { fullName: 'A' } })
        .expect(400);
      assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
    });

    it('reports Maps as unconfigured without inventing a fee', async () => {
      const response = await customerAgent
        .post('/api/delivery/quote')
        .send({ deliveryAddress: address })
        .expect(200);

      const quote = response.body.quote;
      assert.equal(quote.status, 'unavailable');
      assert.equal(quote.reason, 'MAPS_NOT_CONFIGURED');
      assert.equal(quote.checkoutAllowed, true);
      assert.equal(quote.deliveryFeePaise, 0);
      assert.equal(quote.subtotalPaise, 50_000);
      assert.equal(quote.totalPaise, 50_000);
      assert.match(quote.message, /not available yet/i);
    });

    it('validates, stores, publishes and clears store coordinates', async () => {
      const invalid = await sellerAgent
        .patch('/api/stores/me')
        .send({ location: { latitude: 95, longitude: 73.8567 } })
        .expect(400);
      assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');

      const saved = await sellerAgent
        .patch('/api/stores/me')
        .send({ location: { latitude: 18.5204, longitude: 73.8567 } })
        .expect(200);
      assert.deepEqual(saved.body.store.location, {
        latitude: 18.5204,
        longitude: 73.8567,
      });

      // The store summary attached to the customer's cart is public data.
      const cart = await customerAgent.get('/api/cart').expect(200);
      assert.equal(cart.body.cart.store.id, storeId);
      assert.deepEqual(cart.body.cart.store.location, {
        latitude: 18.5204,
        longitude: 73.8567,
      });

      const cleared = await sellerAgent
        .patch('/api/stores/me')
        .send({ location: null })
        .expect(200);
      assert.equal(cleared.body.store.location, undefined);
    });

    it('places a pending-delivery order while Maps is unconfigured', async () => {
      const placed = await customerAgent
        .post('/api/orders')
        .send({
          idempotencyKey: 'phase6-maps-unconfigured-order',
          deliveryAddress: address,
        })
        .expect(201);

      const order = placed.body.order;
      assert.equal(order.deliveryFeeStatus, 'pending_maps_integration');
      assert.equal(order.deliveryFeePaise, 0);
      assert.equal(order.totalPaise, 50_000);
      assert.equal(order.deliveryRoute, undefined);
      assert.match(order.deliveryQuoteMessage, /delivery fee will remain pending/i);
      assert.equal(order.deliveryAddress.location, undefined);
    });

    it('persists a server-calculated route and fee on the order', async () => {
      await sellerAgent
        .patch('/api/stores/me')
        .send({ location: { latitude: 18.5204, longitude: 73.8567 } })
        .expect(200);

      await customerAgent
        .post('/api/cart/items')
        .send({ productId, quantity: 1 })
        .expect(200);

      const originalFetch = globalThis.fetch;
      const originalKey = env.GOOGLE_MAPS_API_KEY;

      try {
        env.GOOGLE_MAPS_API_KEY = 'test-routes-key';
        globalThis.fetch = mockFetch({
          routes: [
            {
              distanceMeters: 4200,
              duration: '900s',
              polyline: { encodedPolyline: 'encoded-route' },
              legs: [
                {
                  startLocation: {
                    latLng: { latitude: 18.5204, longitude: 73.8567 },
                  },
                  endLocation: {
                    latLng: { latitude: 18.531, longitude: 73.844 },
                  },
                },
              ],
            },
          ],
        }).fetchImpl;

        const placed = await customerAgent
          .post('/api/orders')
          .send({
            idempotencyKey: 'phase6-calculated-route-order',
            deliveryAddress: address,
          })
          .expect(201);

        const order = placed.body.order;
        assert.equal(order.deliveryFeeStatus, 'calculated');
        assert.equal(order.deliveryFeePaise, 6000);
        assert.equal(order.subtotalPaise, 25_000);
        assert.equal(order.totalPaise, 31_000);
        assert.equal(order.deliveryQuoteMessage, undefined);
        assert.equal(order.deliveryRoute.distanceMeters, 4200);
        assert.equal(order.deliveryRoute.durationSeconds, 900);
        assert.equal(order.deliveryRoute.polyline, 'encoded-route');
        assert.deepEqual(order.deliveryAddress.location, {
          latitude: 18.531,
          longitude: 73.844,
        });

        const stored = await getDb()
          .collection('orders')
          .findOne({ _id: new ObjectId(order.id) });
        assert.ok(stored);
        assert.equal(stored.deliveryFeeStatus, 'calculated');
        assert.equal(stored.deliveryRoute.provider, 'google_routes');

        const sellerView = await sellerAgent
          .get(`/api/seller/orders/${order.id}`)
          .expect(200);
        assert.deepEqual(sellerView.body.order.deliveryRouteSummary, {
          distanceMeters: 4200,
          durationSeconds: 900,
        });
        assert.equal(sellerView.body.order.deliveryAddress, undefined);
        assert.equal(sellerView.body.order.deliveryRoute, undefined);
      } finally {
        globalThis.fetch = originalFetch;
        env.GOOGLE_MAPS_API_KEY = originalKey;
      }
    });

    it('blocks an unroutable address without reserving stock', async () => {
      await customerAgent
        .post('/api/cart/items')
        .send({ productId, quantity: 1 })
        .expect(200);

      const stockBefore = await getDb()
        .collection('products')
        .findOne({ _id: new ObjectId(productId) });
      assert.ok(stockBefore);
      assert.equal(stockBefore.stock, 2);

      const originalFetch = globalThis.fetch;
      const originalKey = env.GOOGLE_MAPS_API_KEY;

      try {
        env.GOOGLE_MAPS_API_KEY = 'test-routes-key';
        globalThis.fetch = mockFetch({}, 400).fetchImpl;

        const response = await customerAgent
          .post('/api/orders')
          .send({
            idempotencyKey: 'phase6-unroutable-order',
            deliveryAddress: { ...address, line1: 'Not A Real Street 999' },
          })
          .expect(409);

        assert.equal(response.body.error.code, 'DELIVERY_QUOTE_UNAVAILABLE');
        assert.match(response.body.error.message, /could not find/i);
      } finally {
        globalThis.fetch = originalFetch;
        env.GOOGLE_MAPS_API_KEY = originalKey;
      }

      const stockAfter = await getDb()
        .collection('products')
        .findOne({ _id: new ObjectId(productId) });
      assert.ok(stockAfter);
      assert.equal(stockAfter.stock, 2);
      assert.equal(
        await getDb()
          .collection('orders')
          .countDocuments({ idempotencyKey: 'phase6-unroutable-order' }),
        0,
      );

      // The cart is preserved so the customer can correct the address.
      const cart = await customerAgent.get('/api/cart').expect(200);
      assert.equal(cart.body.cart.itemCount, 1);
      await customerAgent.delete('/api/cart').expect(200);
    });
  });
});
