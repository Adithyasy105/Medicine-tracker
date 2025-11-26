# Medicine Tracker App (MediCare+)

> **A smart, offline-first family medicine tracking application powered by Expo, Supabase, and Generative AI.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Android-green.svg)
![Status](https://img.shields.io/badge/status-Active-success.svg)

## Project Overview

**Medicine Tracker** (MediCare+) is a comprehensive mobile application designed to help caregivers and families manage medication schedules efficiently. It goes beyond simple reminders by integrating advanced AI features for prescription scanning and medical advice, all while ensuring data privacy and offline accessibility.

Whether you are managing your own prescriptions or caring for multiple family members, this app provides a seamless, secure, and intelligent way to stay on top of health needs.

## Key Features

### AI-Powered Intelligence
-   **Smart Prescription Scanning**: Snap a photo of a medicine label, and our **Edge Functions** (using Google Cloud Vision OCR + Gemini 2.0 Flash) will automatically extract the medicine name, dosage, and frequency.
-   **Dr. AI Assistant**: A built-in chat interface powered by **Google Gemini 2.0 Flash**. Ask questions about drug interactions, side effects, or general health advice and get instant, evidence-based responses (with appropriate medical disclaimers).

### Intelligent & Strict Notifications
-   **Flood-Proof Scheduling**: Implements strict validation to prevent notification flooding. Notifications are **only** scheduled for future times.
-   **Persistent Tracking**: Uses local storage to track "sent" status for every dose, ensuring you never get duplicate alerts for the same dose, even after restarting the phone.
-   **Smart Alerts**:
    -   **Low Stock**: Alerts you when supply runs low (with a 24-hour cooldown to prevent spam).
    -   **Daily Summary**: A single summary notification at 9:00 PM to review the day's adherence.
-   **Reliable Delivery**: Uses native Android scheduling to ensure notifications fire even if the app is completely closed.

### Family & Profile Management
-   **Multi-Profile Support**: Create and manage separate profiles for each family member (e.g., "Dad", "Mom", "Grandma").
-   **Secure Data Isolation**: Powered by **Supabase Row Level Security (RLS)**, ensuring that users can only access data they are authorized to see.

### Offline-First Architecture
-   **Robust Offline Support**: The app remains fully functional without an internet connection.
-   **Action Queueing**: Changes made offline (adding meds, marking as taken) are queued and automatically synced with Supabase when connectivity is restored.

## Tech Stack

### Frontend
-   **Framework**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) (SDK 50+)
-   **Navigation**: React Navigation v7
-   **State/Data**: React Hooks, Custom Context Providers, AsyncStorage
-   **UI**: StyleSheet, Vector Icons, Safe Area Context

### Backend (Supabase)
-   **Database**: PostgreSQL
-   **Auth**: Supabase Auth (Email/Password)
-   **Storage**: Supabase Storage (for prescription images)
-   **Edge Functions**: Deno-based serverless functions for:
    -   `scanMedicine`: OCR & Parsing (Google Vision + Gemini)
    -   `chat`: AI Health Assistant (Gemini)
    -   `sendPush`: Notification delivery

### AI Services
-   **LLM**: Google Gemini API (`gemini-2.0-flash`)
-   **OCR**: Google Cloud Vision API

## Getting Started

### Prerequisites
-   **Node.js** (v18 or newer)
-   **npm** or **yarn**
-   **Expo CLI**: `npm install -g expo-cli`
-   **EAS CLI**: `npm install -g eas-cli` (For building APKs)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Adithyasy105/Medicine-tracker.git
    cd Medicine-tracker
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory and add your keys:

    ```env
    # Supabase Configuration
    EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

    # AI Configuration
    EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
    ```

### Building the APK (Android)

To generate a standalone APK file for testing or distribution:

1.  **Configure `eas.json`**:
    Ensure your `eas.json` has the `apk` profile configured with your environment variables (or placeholders).

2.  **Run the Build Command**:
    ```bash
    eas build -p android --profile apk
    ```

3.  **Download**:
    Once the build finishes, EAS will provide a link to download the `.apk` file.

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
│   │   └── Notifications.js    # Strict notification scheduling logic
│   ├── theme/           # Design tokens (colors, spacing)
│   └── utils/           # Helper functions
├── supabase/
│   ├── functions/       # Edge Functions source code
│   └── migrations/      # Database schema definitions
├── app.json             # Expo configuration
├── eas.json             # EAS Build configuration
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
