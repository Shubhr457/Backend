# Blockchain REST API

A comprehensive blockchain REST API built with Node.js, Express, MongoDB, and JWT authentication. This mid-level implementation covers all core blockchain concepts including wallet management, transactions, mining, and blockchain validation.

## Features

### Authentication & Authorization
- **JWT-based authentication** with access and refresh tokens
- **Role-based access control** (user, admin)
- **Secure password hashing** with bcrypt
- **Token refresh mechanism**
- **Multi-device session management**

### Wallet Management
- **Cryptographic key pair generation** (RSA 2048-bit)
- **Digital wallet creation** with unique addresses
- **Balance tracking and validation**
- **Wallet ownership protection**
- **Metadata management**

### Transaction System
- **Digital signature verification**
- **Balance validation before transactions**
- **Transaction fee system**
- **Pending/confirmed/failed status tracking**
- **User ownership verification**

### Blockchain Operations
- **Proof-of-work mining** with configurable difficulty
- **Merkle tree implementation** for transaction integrity
- **Block validation and integrity checking**
- **Genesis block initialization**
- **Chain validation algorithms**

### API Features
- **RESTful endpoints** with proper HTTP status codes
- **Request validation** with Joi schemas
- **Pagination and filtering** for all list endpoints
- **Rate limiting** and security headers
- **Comprehensive error handling**

## Prerequisites

- **Node.js** v16+ 
- **MongoDB** v4.4+
- **NPM** or **Yarn**

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd blockchain-rest-api

# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/blockchain_db
JWT_SECRET=your-super-secret-jwt-key-256-bits-blockchain-api-2024
JWT_REFRESH_SECRET=your-refresh-token-secret-key-blockchain-refresh-2024
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
BCRYPT_ROUNDS=12
MINING_DIFFICULTY=4
BLOCK_REWARD=10
```

### 3. Database Setup

```bash
# Seed the database with sample data
npm run seed
```

### 4. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start at `http://localhost:3000`

##  API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Sample Login Credentials
```
Admin: admin@blockchain.com / admin123
Alice: alice@blockchain.com / alice123
Bob: bob@blockchain.com / bob123
Charlie: charlie@blockchain.com / charlie123
```

##  Authentication Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123",
  "profile": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

### Get Profile (Protected)
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

### Update Profile (Protected)
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "profile": {
    "firstName": "John",
    "lastName": "Doe Updated"
  }
}
```

##  Wallet Endpoints

### Create Wallet (Protected)
```http
POST /api/wallets
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {
    "name": "My Main Wallet",
    "description": "Primary wallet for transactions"
  }
}
```

### Get User Wallets (Protected)
```http
GET /api/wallets?limit=20&offset=0&sortBy=createdAt&order=desc
Authorization: Bearer <token>
```

### Get Wallet Details (Owner Only)
```http
GET /api/wallets/{walletId}
Authorization: Bearer <token>
```

### Get Wallet Balance (Owner Only)
```http
GET /api/wallets/{walletId}/balance
Authorization: Bearer <token>
```

### Update Wallet (Owner Only)
```http
PUT /api/wallets/{walletId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {
    "name": "Updated Wallet Name",
    "description": "Updated description"
  }
}
```

### Get Wallet Transactions (Owner Only)
```http
GET /api/wallets/{walletId}/transactions?status=confirmed&limit=20
Authorization: Bearer <token>
```

##  Transaction Endpoints

### Create Transaction (Protected)
```http
POST /api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromWallet": "source-wallet-address-40-chars",
  "toWallet": "destination-wallet-address-40-chars",
  "amount": 10.5,
  "fee": 0.001,
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
}
```

### Validate Transaction (Protected)
```http
POST /api/transactions/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromWallet": "source-wallet-address",
  "toWallet": "destination-wallet-address",
  "amount": 10.5,
  "signature": "transaction-signature"
}
```

### Get Transactions (Public)
```http
GET /api/transactions?status=pending&limit=20&offset=0&sortBy=timestamp&order=desc
```

### Get Transaction Details (Public)
```http
GET /api/transactions/{transactionId}
```

##  Blockchain Endpoints

### Get Blocks (Public)
```http
GET /api/blockchain/blocks?limit=20&offset=0&sortBy=index&order=desc
```

### Get Block Details (Public)
```http
GET /api/blockchain/blocks/{blockId}
```

### Get Blockchain Status (Public)
```http
GET /api/blockchain/status
```

### Mine Block (Admin Only)
```http
POST /api/blockchain/mine
Authorization: Bearer <admin-token>
```

## Validate Blockchain (Admin Only)
```http
GET /api/blockchain/validate
Authorization: Bearer <admin-token>
```

##  Testing

### Run Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Manual Testing with Postman

1. Import the provided Postman collection
2. Set environment variables:
   - `baseUrl`: `http://localhost:3000`
   - `token`: Your JWT token after login
3. Test authentication flow
4. Create wallets and transactions
5. Mine blocks as admin
6. Validate blockchain integrity

##  Development

### Project Structure
```
blockchain-rest-api/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   ├── authController.js    # Authentication logic
│   ├── walletController.js  # Wallet management
│   ├── transactionController.js # Transaction handling
│   └── blockchainController.js  # Blockchain operations
├── middleware/
│   ├── auth.js             # JWT authentication
│   └── validation.js       # Request validation
├── models/
│   ├── User.js             # User schema
│   ├── Wallet.js           # Wallet schema
│   ├── Transaction.js      # Transaction schema
│   └── Block.js            # Block schema
├── routes/
│   ├── auth.js             # Auth routes
│   ├── wallets.js          # Wallet routes
│   ├── transactions.js     # Transaction routes
│   └── blockchain.js       # Blockchain routes
├── scripts/
│   └── seedData.js         # Database seeding
├── utils/
│   └── crypto.js           # Cryptographic utilities
├── server.js               # Main application
└── package.json
```

### Key Technologies
- **Express.js**: Web framework
- **Mongoose**: MongoDB ODM
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT implementation
- **Joi**: Request validation
- **helmet**: Security headers
- **cors**: Cross-origin resource sharing
- **express-rate-limit**: Rate limiting

##  Security Features

- **JWT-based authentication** with short-lived tokens
- **Refresh token rotation** for security
- **Password hashing** with bcrypt (12 rounds)
- **Rate limiting** (100 requests/minute)
- **Input validation** and sanitization
- **Security headers** with Helmet.js
- **Role-based access control**
- **Digital signatures** for transaction verification

##  Performance Considerations

- **Database indexing** on frequently queried fields
- **Connection pooling** for MongoDB
- **Pagination** for large datasets
- **Efficient queries** with Mongoose
- **Response caching** headers
- **Compression** middleware

##  Error Handling

The API implements comprehensive error handling with:
- **Consistent error response format**
- **Detailed validation error messages**
- **Proper HTTP status codes**
- **Request logging** for debugging
- **Graceful server shutdown**

##  Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong JWT secrets
- [ ] Configure MongoDB replica set
- [ ] Set up SSL/TLS certificates
- [ ] Configure reverse proxy (nginx)
- [ ] Set up monitoring and logging
- [ ] Configure environment variables
- [ ] Set up backup strategies

### Docker Support
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

##  API Response Format

All API responses follow this consistent format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  },
  "user": {
    "id": "user-id",
    "username": "username",
    "role": "user"
  },
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasNext": true
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0"
  }
}
```

##  Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

##  License

This project is licensed under the MIT License.

##  Troubleshooting

### Common Issues

**MongoDB Connection Error**
```bash
# Check if MongoDB is running
brew services start mongodb-community

# Or with systemctl on Linux
sudo systemctl start mongod
```

**JWT Token Expired**
```http
POST /api/auth/refresh
```

**Insufficient Balance**
- Check wallet balance before creating transactions
- Ensure you account for transaction fees

**Mining Permission Denied**
- Only admin users can mine blocks
- Login with admin credentials

##  Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the error logs