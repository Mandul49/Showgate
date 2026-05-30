# Showgate 🎫

A modern ticketing platform for event organizers in Africa. Sell tickets, customize event pages, and understand your audience through real-time analytics.

**Live Platform:** [showgate.vercel.app](https://showgate.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)

---

## Overview

Showgate is a full-featured ticketing solution designed specifically for African event organizers. It eliminates payment friction by integrating with local payment providers (Paystack, Stripe, Bank Transfer) and gives organizers complete control over their brand and data.

**Why Showgate?**
- ✅ Nigeria-first with Paystack integration
- ✅ Real-time analytics and audience insights
- ✅ White-label branding for Pro users
- ✅ Multiple payment methods
- ✅ Group tickets and discount codes
- ✅ No vendor lock-in

---

## Features

### For Event Organizers

- **Event Management**
  - Create unlimited events (Pro tier)
  - Multiple ticket tiers and pricing
  - Group ticket support with subscriber management
  - Discount codes (percentage or fixed amount)
  
- **Payment & Payouts**
  - Instant payouts to organizer bank account
  - Paystack integration (Free tier)
  - Stripe and Bank Transfer (Pro tier)
  - Automatic subaccount creation

- **Branding & Customization**
  - Custom event pages with organizer branding
  - Auto-extracted color themes from logo
  - White-label option (Pro tier)
  - Dark/Light mode support

- **Analytics**
  - Real-time ticket sales tracking
  - Revenue breakdown
  - Buyer demographics
  - Ticket mix analysis
  - CSV data export

- **Account Management**
  - Update bank details anytime
  - Subscription management
  - Team member access (roadmap)

### For Ticket Buyers

- Browse and purchase tickets
- Apply discount codes at checkout
- Email confirmations with event details
- Live countdown timer to event
- Secure checkout experience

### For Administrators

- Organizer management and tier control
- Subscription management and renewables
- Platform-wide analytics and revenue tracking
- Event and ticket moderation
- Multi-role admin team support
- Audit logs for all actions
- Platform settings and fee configuration

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast builds
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management
- **Axios** for API calls

### Backend
- **Node.js** with Express
- **TypeScript**
- **Drizzle ORM** for database management
- **PostgreSQL** as primary database
- **JWT** for authentication

### Services
- **Paystack** - Primary payment processor
- **Stripe** - Alternative payment gateway
- **Supabase** - PostgreSQL database hosting
- **Brevo** - Email service (confirmations, password resets)
- **Vercel** - Frontend deployment
- **Railway** - Backend deployment

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL database
- Paystack account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mandul49/showgate.git
   cd showgate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   
   Create `.env.local` in the root:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/showgate
   
   # Payment
   PAYSTACK_SECRET_KEY=your_paystack_secret_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   
   # Email
   BREVO_API_KEY=your_brevo_api_key
   
   # App
   JWT_SECRET=your_jwt_secret_key
   NODE_ENV=development
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```

5. **Start development servers**
   
   Terminal 1 - Frontend:
   ```bash
   cd client
   npm run dev
   ```
   
   Terminal 2 - Backend:
   ```bash
   npm run dev:server
   ```

6. **Open in browser**
   ```
   http://localhost:5173
   ```

---

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Set **Root Directory** to `client`
4. Set **Framework** to Vite
5. Add environment variable: `VITE_API_URL` = your backend URL
6. Deploy

### Backend (Railway)

1. Create Railway project
2. Connect GitHub repo
3. Set **Root Directory** to `/` (repo root)
4. Add environment variables:
   - `DATABASE_URL` (from Supabase)
   - `PAYSTACK_SECRET_KEY`
   - `STRIPE_SECRET_KEY`
   - `BREVO_API_KEY`
   - `JWT_SECRET`
5. Deploy

### Database (Supabase)

1. Create Supabase project
2. Get PostgreSQL connection string
3. Add to Railway as `DATABASE_URL`
4. Run migrations on Supabase

---

## Project Structure

```
showgate/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── store/         # Zustand state
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
│
├── server/                # Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Auth, validation
│   │   ├── services/      # Business logic
│   │   └── index.ts
│   └── package.json
│
├── migrations/            # Database migrations (Drizzle)
├── shared/               # Shared types and utilities
└── package.json          # Root dependencies
```

---

## Environment Variables

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `PAYSTACK_SECRET_KEY` | Paystack API key | `sk_live_...` |
| `STRIPE_SECRET_KEY` | Stripe API key | `sk_live_...` |
| `BREVO_API_KEY` | Brevo email service key | `xkeysib...` |
| `JWT_SECRET` | JWT signing secret | Any strong random string |
| `NODE_ENV` | Environment | `development`, `production` |
| `PORT` | Server port | `3000` (default) |

### Frontend (.env.local)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://api.showgate.com` |

---

## API Documentation

### Authentication
- **POST** `/api/auth/signup` - Create organizer account
- **POST** `/api/auth/login` - Login
- **POST** `/api/auth/refresh` - Refresh JWT token

### Events
- **GET** `/api/events` - List events
- **POST** `/api/events` - Create event
- **GET** `/api/events/:id` - Get event details
- **PUT** `/api/events/:id` - Update event

### Tickets
- **GET** `/api/tickets/:eventId` - List tickets for event
- **POST** `/api/tickets` - Purchase ticket
- **GET** `/api/tickets/:id` - Ticket details

### Analytics
- **GET** `/api/analytics/dashboard` - Dashboard stats
- **GET** `/api/analytics/events/:id` - Event analytics

See `/docs` endpoint for full OpenAPI documentation.

---

## Pricing Tiers

### Free
- ₦0/month
- 500 tickets/month max
- 1 active event
- Paystack only
- 2.5% platform fee
- Basic analytics

### Pro
- ₦12,000/month or ₦120,000/year
- Unlimited tickets
- Unlimited active events
- Paystack + Stripe + Bank Transfer
- 0% platform fee
- Full white-label
- Advanced analytics with CSV export

---

## Development

### Running Tests
```bash
npm run test
npm run test:server
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Building for Production
```bash
npm run build
npm run build:server
```

---

## Security

- All passwords hashed with bcrypt
- JWTs expire in 24 hours
- HTTPS enforced in production
- SQL injection protection via Drizzle ORM
- CORS configured for approved domains
- Rate limiting on API endpoints
- PCI compliance via Paystack/Stripe

---

## Known Issues & Roadmap

### Current Limitations
- Email verification temporarily disabled (domain setup pending)
- Admin dashboard analytics limited to 30 days
- Mobile app not yet available

### Upcoming Features
- [ ] Team member management
- [ ] Multi-currency support
- [ ] Mobile app (iOS/Android)
- [ ] Advanced seating charts
- [ ] Refund management
- [ ] Email campaign tools
- [ ] Webhook events
- [ ] API for third-party integrations

---

## Support

- **Documentation:** [docs.showgate.com](https://docs.showgate.com)
- **Email:** support@showgate.com
- **Issues:** [GitHub Issues](https://github.com/Mandul49/showgate/issues)

---

## License

MIT License - see LICENSE file for details

---

## Author

**Mandul Johnson**  
Founder, Musick & Tea Creative Ministry  
[GitHub](https://github.com/Mandul49) | [Twitter](https://twitter.com/Mandul49)

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Changelog

### v1.0.0 (Current)
- ✅ Core ticketing platform
- ✅ Paystack integration
- ✅ Event analytics
- ✅ Admin panel
- ✅ White-label branding
- ✅ Group tickets
- ✅ Discount codes

See [CHANGELOG.md](CHANGELOG.md) for full history.

---

**Made with ❤️ for African event organizers**
