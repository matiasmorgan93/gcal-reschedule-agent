# Google Calendar Rescheduler - Modern UI

A beautiful, modern web application for rescheduling Google Calendar events with AI assistance. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🔐 **Google OAuth Authentication** - Secure sign-in with Google
- 📅 **Real Calendar Integration** - Direct access to your Google Calendar
- 🎨 **Modern UI Design** - Beautiful, responsive interface
- ⚡ **Fast & Responsive** - Built with Next.js for optimal performance
- 🔄 **Smart Rescheduling** - Keep event duration or set custom times
- 📱 **Mobile Friendly** - Works perfectly on all devices

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd gcal-rescheduler-ui
npm install
```

### 2. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Choose **Web application** type
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback` (for development)
   - `https://yourdomain.com/api/auth/callback` (for production)

### 3. Configure Environment Variables

Copy `env.example` to `.env.local` and fill in your Google OAuth credentials:

```bash
cp env.example .env.local
```

Edit `.env.local`:
```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Sign In** - Click "Sign in with Google" to authenticate
2. **Select Event** - Choose an event from your upcoming calendar
3. **Pick New Time** - Select a new date and time
4. **Reschedule** - Click the button to update your calendar
5. **Success** - View confirmation and open your updated calendar

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Authentication**: Google OAuth 2.0
- **Calendar API**: Google Calendar API v3
- **Icons**: Lucide React

## Project Structure

```
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── events/         # Calendar events API
│   │   └── reschedule/     # Event rescheduling API
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main application page
├── components/
│   └── ui/                 # Reusable UI components
├── lib/
│   └── utils.ts            # Utility functions
└── public/                 # Static assets
```

## API Endpoints

- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/callback` - Handle OAuth callback
- `GET /api/auth/status` - Check authentication status
- `GET /api/events` - Fetch calendar events
- `POST /api/reschedule` - Reschedule an event

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI | Yes |

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Include your environment and steps to reproduce
