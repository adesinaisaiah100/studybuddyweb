# Study Zone Web 📚

Study Zone Web is an intelligent, Next.js-powered educational assistant designed to orchestrate resources and provide enhanced web search capabilities for studying. 

It leverages Google's Gemini models for advanced search and information retrieval, with built-in fallbacks to Tavily and Wikipedia to ensure you always get the answers you need.

## 🚀 Features

- **Resource Orchestrator**: Uses AI models to search, synthesize, and organize study materials.
- **Google Gemini Integration**: Powered by Google AI Studio (defaulting to `gemini-2.5-pro`) for high-quality, contextual web search.
- **Smart Fallbacks**: Automatically falls back to Tavily or Wikipedia web search if Google AI keys are missing or limits are reached.
- **Modern Tech Stack**: Built with Next.js App Router, React, and TypeScript.
- **Optimized UI**: Utilizes `next/font` with the Geist font family for a sleek, fast-loading user experience.

## 🛠️ Getting Started

### Prerequisites

Make sure you have Node.js installed, along with your preferred package manager (`npm`, `yarn`, `pnpm`, or `bun`).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/adesinaisaiah100/studybuddyweb.git
   cd studybuddyweb
   ```

2. Install dependencies:
   ```bash
   npm install
   # or yarn / pnpm / bun install
   ```

### Environment Variables

To enable the Google-powered resource orchestrator, create a `.env.local` file in the root directory and add your API credentials:

```bash
GOOGLE_API_KEY=your_google_ai_studio_api_key
GOOGLE_SEARCH_MODEL=gemini-2.5-pro
```

*Notes:*
- You can change `GOOGLE_SEARCH_MODEL` to any supported Gemini model.
- If these values are omitted, the application will seamlessly fall back to using Tavily/Wikipedia for search functionalities.

### Running the Development Server

Start the app locally:

```bash
npm run dev
# or yarn dev / pnpm dev / bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application. You can start editing the main page by modifying `app/page.tsx`.

## 📖 Learn More

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API.
- [Google AI Studio](https://aistudio.google.com/) - Get your API key and learn about Gemini models.

## ☁️ Deployment

The easiest way to deploy this Next.js app is via the [Vercel Platform](https://vercel.com/new). Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.