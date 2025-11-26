# Medicine Tracker App

> **A smart, offline-first family medicine tracking application powered by Expo, Supabase, and Generative AI.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)
![Status](https://img.shields.io/badge/status-Active-success.svg)

## Project Overview

**Medicine Tracker** is a comprehensive mobile application designed to help caregivers and families manage medication schedules efficiently. It goes beyond simple reminders by integrating advanced AI features for prescription scanning and medical advice, all while ensuring data privacy and offline accessibility.

Whether you are managing your own prescriptions or caring for multiple family members, this app provides a seamless, secure, and intelligent way to stay on top of health needs.

## Key Features

### AI-Powered Intelligence
-   **Smart Prescription Scanning**: Snap a photo of a medicine label, and our **Edge Functions** (using Google Cloud Vision OCR + Gemini LLM) will automatically extract the medicine name, dosage, and frequency.
-   **Dr. AI Assistant**: A built-in chat interface powered by **Google Gemini 2.0 Flash**. Ask questions about drug interactions, side effects, or general health advice and get instant, evidence-based responses (with appropriate medical disclaimers).

### Family & Profile Management
-   **Multi-Profile Support**: Create and manage separate profiles for each family member.
-   **Secure Data Isolation**: Powered by **Supabase Row Level Security (RLS)**, ensuring that users can only access data they are authorized to see.

### Intelligent Notifications
-   **Local Reminders**: Reliable local notifications for daily doses, ensuring you never miss a pill even without internet.
-   **Smart Alerts**: Background jobs check for low stock and missed doses, sending push notifications to keep you informed.

### Offline-First Architecture
-   **Robust Offline Support**: The app remains fully functional without an internet connection.
-   **Action Queueing**: Changes made offline (adding meds, marking as taken) are queued and automatically synced with Supabase when connectivity is restored.

## Tech Stack

### Frontend
-   **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 50+)
-   **Navigation**: React Navigation v7
-   **State/Data**: React Hooks, Custom Context Providers
-   **UI**: StyleSheet, Vector Icons, Safe Area Context

### Backend (Supabase)
-   **Database**: PostgreSQL
-   **Auth**: Supabase Auth (Email/Password)
-   **Storage**: Supabase Storage (for prescription images)
-   **Edge Functions**: Deno-based serverless functions for:
    -   `scanMedicine`: OCR & Parsing
    -   `sendPush`: Notification delivery
    -   `refillChecker`: Cron job for stock alerts
    -   `missedDoseChecker`: Cron job for compliance tracking

### AI Services
-   **LLM**: Google Gemini API (`gemini-2.0-flash`)
-   **OCR**: Google Cloud Vision API

## Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
-   **Node.js** (v18 or newer)
-   **npm** or **yarn**
-   **Expo CLI**: `npm install -g expo-cli`
-   **Supabase CLI**: `npm install -g supabase`
-   **Expo Go**: Installed on your iOS/Android device or an Emulator.

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd medicine-tracker
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory (copy from `.env.example` if available) and add your keys:

    ```env
    # Supabase Configuration
    EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

    # AI Configuration
    EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
    ```

### Backend Setup (Supabase)

1.  **Initialize Supabase**
    ```bash
    supabase init
    ```

2.  **Apply Migrations** (Pushes schema to your remote or local DB)
    ```bash
    supabase db push
    ```

3.  **Deploy Edge Functions**
    ```bash
    supabase functions deploy scanMedicine markTaken refillChecker missedDoseChecker sendPush
    ```

4.  **Set Edge Function Secrets**
    ```bash
    supabase secrets set --env-file ./supabase/.env
    ```
    *Ensure your `./supabase/.env` contains `VISION_API_KEY`, `OPENAI_API_KEY` (or `GEMINI_API_KEY`), and `SUPABASE_SERVICE_ROLE_KEY`.*

### Running the App

Start the Expo development server:

```bash
npx expo start
```

-   Press `a` for Android Emulator.
-   Press `i` for iOS Simulator.
-   Scan the QR code with the **Expo Go** app on your physical device.

## Project Structure

```
medicine-tracker/
├── assets/              # Images, fonts, and icons
├── src/
│   ├── components/      # Reusable UI components (Cards, Inputs, etc.)
│   ├── hooks/           # Custom hooks (useMedicines, useAuth)
│   ├── lib/             # Supabase client configuration
│   ├── providers/       # Context providers (AuthProvider)
│   ├── screens/         # Application screens
│   │   ├── AuthScreen.js
│   │   ├── ChatScreen.js       # Dr. AI implementation
│   │   ├── DashboardScreen.js
│   │   ├── ScanScreen.js       # Camera & Image handling
│   │   └── ...
│   ├── services/        # Business logic & External services
│   │   ├── OfflineQueue.js     # Sync logic
│   │   └── Notifications.js
│   ├── theme/           # Design tokens (colors, spacing)
│   └── utils/           # Helper functions
├── supabase/
│   ├── functions/       # Edge Functions source code
│   └── migrations/      # Database schema definitions
├── app.json             # Expo configuration
├── package.json         # Dependencies and scripts
└── README.md            # Project documentation
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

*Note: This project is for educational and personal management purposes. The "Dr. AI" feature provides information based on AI models and should not replace professional medical advice.*
