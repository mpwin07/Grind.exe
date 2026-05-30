# grind.exe ⚔️

An AI-powered, highly customized LeetCode tracking dashboard designed with a sleek cyberpunk aesthetic to supercharge your coding interview preparation.

## ✨ Features

- **AI Mode**: Powered by Groq. Get intelligent problem recommendations, study plans, and topic analysis customized to your actual LeetCode profile weaknesses.
- **Dynamic Streaks Dashboard**: Real-time tracking of your weekly and monthly problem-solving consistency.
- **Interactive Heatmap**: GitHub-style submission calendar heatmap to visualize your daily grind.
- **Skill Breakdown**: Beautiful SVG donut charts visualizing your performance across Easy, Medium, and Hard difficulties.
- **Milestones & XP System**: Gamified experience tracking to reward consistency and broad topic mastery.
- **Sleek Aesthetic**: Completely custom "neon" theme with instant CSS variable application for a personalized cyberpunk feel.

## 🛠️ Tech Stack

- **Framework**:[React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend/DB**: [Supabase](https://supabase.com/)
- **AI Integration**: [Groq API](https://console.groq.com/docs/quickstart)

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v22+ recommended)
- `npm`

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd leetcode
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your API keys:
   ```env
   # Your Groq API Key
   GROQ_API_KEY=your_groq_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   npm run preview
   ```

## 🎮 Usage

1. Open `http://localhost:8080` in your browser.
2. Link your LeetCode username via the settings or dashboard prompt.
3. Access **AI Mode** to generate custom practice sets.
4. Check the **Streaks** tab to visualize your consistency and claim milestones.

## 📜 License

MIT License
